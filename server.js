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
  try {
    const id = Math.random().toString(36).slice(2, 10);
    const { error } = await supabase
      .from('pending_orders')
      .insert({ id, chat_id: chat, payload: p });
    if (error) {
      console.error('savePendingDb error details:', error);
      throw error;
    }
    return id;
  } catch (err) {
    console.error('savePendingDb exception:', err);
    throw err;
  }
}

async function getPendingDb(chat, id) {
  if (!id) return null;
  try {
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
  } catch (err) {
    console.error('getPendingDb exception:', err);
    return null;
  }
}

async function updatePendingDb(chat, id, p) {
  try {
    const { error } = await supabase
      .from('pending_orders')
      .update({ payload: p })
      .eq('id', String(id))
      .eq('chat_id', chat);
    if (error) throw error;
  } catch (err) {
    console.error('updatePendingDb exception:', err);
    throw err;
  }
}

async function deletePendingDb(chat, id) {
  if (!id) return;
  try {
    const { error } = await supabase
      .from('pending_orders')
      .delete()
      .eq('id', String(id))
      .eq('chat_id', chat);
    if (error) console.error('deletePendingDb error:', error);
  } catch (err) {
    console.error('deletePendingDb exception:', err);
  }
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
    return reply(ev.replyToken, [text(`ไม่แน่ใจว่าเดือนไหน ลองพิมพ์เช่น สรุป Nov / สรุป พ.ย. /สรุป เดือนหน้า`, recent)]);
  } catch (err) {
    console.error('onSummary error:', err);
    return reply(ev.replyToken, [text('เกิดข้อผิดพลาดในการดึงข้อมูลสรุป')]);
  }
}

async function onText(ev) {
  try {
    const t = ev.message.text.trim();
    const chat = chatOf(ev.source);
    const m = t.match(/^(?:สรุป\s*|(?:summary|sum)\b\s*)(.*)$/i);
    if (m) return onSummary(ev, chat, m[1].trim());
    
    const p = parse(t);
    if (!p) return;
    p.ym = ymFor(p.day);
    p.status = 'order';
    const id = await savePendingDb(chat, p);
    return reply(ev.replyToken, [confirmMessage(p, id)]);
  } catch (err) {
    console.error('onText error:', err);
    try {
      return reply(ev.replyToken, [text('เกิดข้อผิดพลาดในการบันทึกออเดอร์ กรุณาลองใหม่อีกครั้ง')]);
    } catch (e) {
      console.error('Failed to reply error message:', e);
    }
  }
}

async function onPostback(ev) {
  try {
    const chat = chatOf(ev.source);
    const d = new URLSearchParams(ev.postback.data);
    const a = d.get('a');

    if (a === 'status') {
      const o = await db.updateOrderStatus(chat, +d.get('o'), d.get('s'));
      if (!o) return reply(ev.replyToken, [text('ไม่พบรายการนี้แล้ว')]);
      return reply(ev.replyToken, [await monthMsg(chat, o.ym)]);
    }

    if (a === 'next' || a === 'del') {
      let o;
      if (a === 'next') {
        const currentOrder = await db.getOrder(chat, +d.get('o'));
        if (!currentOrder) return reply(ev.replyToken, [text('ไม่พบรายการนี้แล้ว')]);
        const nextStatus = currentOrder.status === 'ยังไม่ได้ Order' ? 'ออเดอร์แล้ว' : 'ยังไม่ได้ Order';
        o = await db.updateOrderStatus(chat, +d.get('o'), nextStatus);
      } else {
        o = await db.deleteOrder(chat, +d.get('o'));
      }
      if (!o) return reply(ev.replyToken, [text('ไม่พบรายการนี้แล้ว')]);
      return reply(ev.replyToken, [await monthMsg(chat, o.ym)]);
    }

    const id = d.get('p');
    if (!id) {
      return reply(ev.replyToken, [text('คำสั่งไม่ถูกต้องหรือหมดอายุแล้ว')]);
    }

    const p = await getPendingDb(chat, id);
    if (!p) {
      return reply(ev.reply
