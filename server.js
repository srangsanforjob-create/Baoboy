require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const db = require('./src/db');
const { parse } = require('./src/catalog');
const { resolveMonth, addMonths, mlabel, MN } = require('./src/months');
const { monthsMessage, confirmMessage } = require('./src/flex');

const config = { channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN, channelSecret: process.env.LINE_CHANNEL_SECRET };
const client = new line.messagingApi.MessagingApiClient({ channelAccessToken: config.channelAccessToken });
const reply = (replyToken, messages) => client.replyMessage({ replyToken, messages });
const text = (t, quick) => ({ type: 'text', text: t, ...(quick ? { quickReply: { items: quick } } : {}) });

const bkk = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const todayYm = () => bkk().slice(0, 7);
// วันที่ >= วันนี้ = เดือนนี้, น้อยกว่าวันนี้ = เดือนถัดไป
const ymFor = (day) => (day >= +bkk().slice(8) ? todayYm() : addMonths(todayYm(), 1));
const chatOf = (s) => s.groupId || s.roomId || s.userId;
const ymQuick = (ym) => ({ type: 'action', action: { type: 'message', label: mlabel(ym).slice(0, 20), text: `สรุป ${mlabel(ym)}` } });

async function monthMsg(chat, ym) { return monthsMessage([[ym, await db.listOrders(chat, ym)]]); }

async function onSummary(ev, chat, rest) {
  const yms = await db.monthsWithData(chat);
  if (!rest) {
    if (!yms.length) return reply(ev.replyToken, [text('ยังไม่มีออเดอร์')]);
    const list = [];
    for (const ym of yms.slice(-12)) list.push([ym, await db.listOrders(chat, ym)]);
    return reply(ev.replyToken, [monthsMessage(list)]);
  }
  const r = resolveMonth(rest, todayYm(), yms);
  if (r.kind === 'ok') return reply(ev.replyToken, [await monthMsg(chat, r.ym)]);
  if (r.kind === 'ask') return reply(ev.replyToken, [text('หมายถึงสรุปของเดือนไหนครับ?', r.options.map(ymQuick))]);
  const recent = (yms.length ? yms : [todayYm()]).slice(-4).map(ymQuick);
  return reply(ev.replyToken, [text(`ไม่แน่ใจว่าเดือนไหน ลองพิมพ์เช่น สรุป Nov / สรุป พ.ย. / สรุป เดือนหน้า`, recent)]);
}

async function onText(ev) {
  const t = ev.message.text.trim();
  const chat = chatOf(ev.source);
  const m = t.match(/^(?:สรุป\s*|(?:summary|sum)\b\s*)(.*)$/i);
  if (m) return onSummary(ev, chat, m[1].trim());
  const p = parse(t);
  if (!p) return; // ข้อความทั่วไปในกลุ่ม: ไม่ตอบ
  p.ym = ymFor(p.day);
  const id = await db.savePending(chat, p);
  return reply(ev.replyToken, [confirmMessage(p, id)]);
}

async function onPostback(ev) {
  const chat = chatOf(ev.source);
  const d = new URLSearchParams(ev.postback.data);
  const a = d.get('a');
  if (a === 'next' || a === 'del') {
    const o = a === 'next' ? await db.cycleStatus(chat, +d.get('o')) : await db.deleteOrder(chat, +d.get('o'));
    if (!o) return reply(ev.replyToken, [text('ไม่พบรายการนี้แล้ว')]);
    return reply(ev.replyToken, [await monthMsg(chat, o.ym)]);
  }
  const id = d.get('p');
  const p = await db.getPending(chat, id);
  if (!p) return reply(ev.replyToken, [text('รายการนี้หมดอายุแล้ว กรุณาพิมพ์ใหม่')]);
  if (a === 'cancel') { await db.deletePending(id); return reply(ev.replyToken, [text('ยกเลิกแล้ว')]); }
  if (a === 'ok') {
    const items = [];
    p.items.filter((i) => i.pid !== null).forEach((i) => {
      const e = items.find((x) => x.pid === i.pid);
      if (e) e.q += i.q; else items.push({ pid: i.pid, q: i.q });
    });
    await db.upsertOrder(chat, { ym: p.ym, day: p.day, status: p.status, items });
    await db.deletePending(id);
    return reply(ev.replyToken, [await monthMsg(chat, p.ym)]);
  }
  if (a === 'pick') p.items[+d.get('i')].pid = +d.get('c');
  else if (a === 'skip') p.items.splice(+d.get('i'), 1);
  else if (a === 'mm') p.ym = addMonths(p.ym, +d.get('d'));
  await db.updatePending(id, p);
  return reply(ev.replyToken, [confirmMessage(p, id)]);
}

const app = express();
app.get('/', (_, res) => res.send('Baoboy SUM bot is running'));
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map((ev) => {
      if (ev.type === 'message' && ev.message.type === 'text') return onText(ev);
      if (ev.type === 'postback') return onPostback(ev);
    }));
  } catch (e) { console.error(e); }
  res.sendStatus(200);
});
db.init().then(() => app.listen(process.env.PORT || 3000, () => console.log('listening'))).catch((e) => { console.error(e); process.exit(1); });
