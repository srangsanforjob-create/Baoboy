const { Pool } = require('pg');
const crypto = require('crypto');
const url = process.env.DATABASE_URL || '';
const pool = new Pool({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
});
const q = (text, params) => pool.query(text, params);

async function init() {
  await q(`create table if not exists orders(
    id serial primary key, chat_id text not null, ym text not null, day int not null,
    status text not null, items jsonb not null, created_at timestamptz default now())`);
  await q('create index if not exists orders_chat_ym on orders(chat_id, ym)');
  await q(`create table if not exists pending(
    id text primary key, chat_id text not null, payload jsonb not null, created_at timestamptz default now())`);
  await q("delete from pending where created_at < now() - interval '1 day'");
}
const listOrders = async (chat, ym) =>
  (await q('select * from orders where chat_id=$1 and ym=$2 order by day, id', [chat, ym])).rows;
const monthsWithData = async (chat) =>
  (await q('select distinct ym from orders where chat_id=$1 order by ym', [chat])).rows.map((r) => r.ym);
const getOrder = async (chat, id) =>
  (await q('select * from orders where chat_id=$1 and id=$2', [chat, id])).rows[0];

// วันเดียว + สถานะเดียวกัน -> รวมจำนวน
async function upsertOrder(chat, { ym, day, status, items }) {
  const ex = (await q('select * from orders where chat_id=$1 and ym=$2 and day=$3 and status=$4',
    [chat, ym, day, status])).rows[0];
  if (!ex) {
    await q('insert into orders(chat_id,ym,day,status,items) values($1,$2,$3,$4,$5)', [chat, ym, day, status, JSON.stringify(items)]);
    return;
  }
  const merged = ex.items;
  for (const i of items) {
    const e = merged.find((x) => x.pid === i.pid);
    if (e) e.q += i.q; else merged.push(i);
  }
  await q('update orders set items=$1 where id=$2', [JSON.stringify(merged), ex.id]);
}

// ฟังก์ชันอัปเดตสถานะออเดอร์โดยตรงตามที่เลือก
async function updateOrderStatus(chat, id, status) {
  const o = await getOrder(chat, id);
  if (!o) return null;
  await q('update orders set status=$1 where id=$2', [status, o.id]);
  o.status = status; // ส่งค่าสถานะใหม่กลับไปให้ระบบใช้แสดงผล
  return o;
}

async function deleteOrder(chat, id) {
  const o = await getOrder(chat, id);
  if (o) await q('delete from orders where id=$1', [o.id]);
  return o;
}
async function savePending(chat, p) {
  const id = crypto.randomBytes(5).toString('hex');
  await q('insert into pending(id,chat_id,payload) values($1,$2,$3)', [id, chat, JSON.stringify(p)]);
  return id;
}
const getPending = async (chat, id) =>
  (await q('select payload from pending where id=$1 and chat_id=$2', [id, chat])).rows[0]?.payload;
const updatePending = (id, p) => q('update pending set payload=$1 where id=$2', [JSON.stringify(p), id]);
const deletePending = (id) => q('delete from pending where id=$1', [id]);

module.exports = { init, listOrders, monthsWithData, getOrder, upsertOrder, updateOrderStatus, deleteOrder, savePending, getPending, updatePending, deletePending };
