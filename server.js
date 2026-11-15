require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');
const db = require('./src/db');
const { parse } = require('./src/catalog');
const { resolveMonth, addMonths, mlabel } = require('./src/months');
const { monthsMessage, confirmMessage } = require('./src/flex');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const reply = (replyToken, messages) => client.replyMessage({ replyToken, messages });
const text = (t, quick) => ({ type: 'text', text: t, ...(quick ? { quickReply: { items: quick } } : {}) });

const bkk = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const todayYm = () => bkk().slice(0, 7);
const ymFor = (day) => (day >= +bkk().slice(8) ? todayYm() : addMonths(todayYm(), 1));
const chatOf = (s) => s.groupId || s.roomId || s.userId;
const ymQuick = (ym) => ({
  type: 'action',
  action: { type: 'message', label: mlabel(ym).slice(0, 20), text: `สรุป ${mlabel(ym)}` },
});

// Supabase Pending Orders Helpers
async function savePendingDb(chat, p) {
  const id = Math.random().toString(36).slice(2, 10);
  const { error } = await supabase
    .from('pending_orders')
    .insert({ id, chat_id: chat, payload: p });
  if (error) throw error;
  return id;
}

async function getPendingDb(chat, id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from('pending_orders')
    .select('payload')
    .eq('id', String(id))
    .eq('chat_id', chat)
    .maybeSingle();
  if (error) {
    console.error('getPendingDb error:', error);
    return null;
  }
  return data ? data.payload : null;
}

async function updatePendingDb(chat, id, p) {
  const { error } = await supabase
    .from('pending_orders')
    .update({ payload: p })
    .eq('id', String(id))
    .eq('chat_id', chat);
  if (error) throw error;
}

async function deletePendingDb(chat, id) {
  if (!id) return;
  const { error } = await supabase
    .from('pending_orders')
    .delete()
    .eq('id', String(id))
    .eq('chat_id', chat);
  if (error) console.error('deletePendingDb error:', error);
}

async function monthMsg(chat, ym) {
  return monthsMessage([[ym, await db.listOrders(chat, ym)]]);
}

async function onSummary(ev, chat, rest) {
  try {
    const yms = (typeof db.monthsWithData === 'function') ? await db.monthsWithData(chat) : [];
    if (!rest) {
      if (!yms || !yms.length) return reply(ev.replyToken, [text('ยังไม่มีออเดอร์')]);
      const list = [];
      for (const ym of yms.slice(-12)) list.push([ym, await db.listOrders(chat, ym)]);
      return reply(ev.replyToken, [monthsMessage(list)]);
    }
    const r = resolveMonth(rest, todayYm(), yms);
    if (r.kind === 'ok') return reply(ev.replyToken, [await monthMsg(chat, r.ym)]);
    if (r.kind === 'ask') return reply(ev.replyToken, [text('หมายถึงสรุปของเดือนไหนครับ?', r.options.map(ymQuick))]);
    const recent = (yms.length ? yms : [todayYm()]).slice(-4).map(ymQuick);
    return reply(ev.replyToken, [text(`ไม่แน่ใจว่าเดือนไหน ลองพิมพ์เช่น สรุป Nov / สรุป พ.ย. / สรุป เดือนหน้า`, recent)]);
  } catch (err) {
    console.error('onSummary error:', err);
    return reply(ev.replyToken, [text('เกิดข้อผิดพลาดในการดึงข้อมูลสรุป')]);
  }
}

async function onText(ev) {
  const t = ev.message.text.trim();
  const chat = chatOf(ev.source);
  const m = t.match(/^(?:สรุป\s*|(?:summary|sum)\b\s*)(.*)$/i);
  if (m) return onSummary(ev, chat, m[1].trim());
  const p = parse(t);
  if (!p) return;
  p.ym = ymFor(p.day);
  const id = await savePendingDb(chat, p);
  return reply(ev.replyToken, [confirmMessage(p, id)]);
}

async function onPostback(ev) {
  const chat = chatOf(ev.source);
  const d = new URLSearchParams(ev.postback.data);
  const a = d.get('a');

  if (a === 'status') {
    const o = await db.updateOrderStatus(chat, +d.get('o'), d.get('s'));
    if (!o) return reply(ev.replyToken, [text('ไม่พบรายการนี้แล้ว')]);
    return reply(ev.replyToken, [await monthMsg(chat, o.ym)]);
  }

  if (a === 'next' || a === 'del') {
    const o = a === 'next' ? await db.cycleStatus(chat, +d.get('o')) : await db.deleteOrder(chat, +d.get('o'));
    if (!o) return reply(ev.replyToken, [text('ไม่พบรายการนี้แล้ว')]);
    return reply(ev.replyToken, [await monthMsg(chat, o.ym)]);
  }

  const id = d.get('p');
  if (!id) {
    return reply(ev.replyToken, [text('คำสั่งไม่ถูกต้องหรือหมดอายุแล้ว')]);
  }

  const p = await getPendingDb(chat, id);
  if (!p) {
    return reply(ev.replyToken, [text('รายการนี้หมดอายุแล้ว กรุณาพิมพ์ใหม่')]);
  }

  if (a === 'cancel') {
    await deletePendingDb(chat, id);
    return reply(ev.replyToken, [text('ยกเลิกแล้ว')]);
  }

  if (a === 'ok') {
    const items = [];
    p.items
      .filter((i) => i.pid !== null)
      .forEach((i) => {
        const e = items.find((x) => x.pid === i.pid);
        if (e) e.q += i.q;
        else items.push({ pid: i.pid, q: i.q });
      });
    await db.upsertOrder(chat, { ym: p.ym, day: p.day, status: p.status, items });
    await deletePendingDb(chat, id);
    return reply(ev.replyToken, [await monthMsg(chat, p.ym)]);
  }

  if (a === 'pick') p.items[+d.get('i')].pid = +d.get('c');
  else if (a === 'skip') p.items.splice(+d.get('i'), 1);
  else if (a === 'mm') p.ym = addMonths(p.ym, +d.get('d'));

  await updatePendingDb(chat, id, p);
  return reply(ev.replyToken, [confirmMessage(p, id)]);
}

const app = express();
app.get('/', (_, res) => res.send('Baoboy SUM bot is running'));

app.post(
  '/webhook',
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
  async (req, res) => {
    console.log('Webhook received:', JSON.stringify(req.body));
    const signature = req.headers['x-line-signature'];
    if (!line.validateSignature(req.rawBody, config.channelSecret, signature)) {
      console.error('Invalid signature!');
      return res.status(401).send('Invalid signature');
    }

    try {
      await Promise.all(
        req.body.events.map((ev) => {
          if (ev.type === 'message' && ev.message.type === 'text') return onText(ev);
          if (ev.type === 'postback') return onPostback(ev);
        })
      );
    } catch (e) {
      console.error(e);
    }
    res.sendStatus(200);
  }
);

db.init()
  .then(() => app.listen(process.env.PORT || 3000, () => console.log('listening')))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
