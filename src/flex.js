const { P, CATS } = require('./catalog');
const { mlabel } = require('./months');
const SM = {
  order: ['⏩ รอจัดส่ง', '#2B6CB0'],
  delivery: ['📦 จัดส่งแล้วรอชำระ', '#B45309'],
  paid: ['✅ ชำระเงินแล้ว', '#1F7A45'],
};
const txt = (text, o = {}) => ({ type: 'text', text: String(text), wrap: true, ...o });
const row = (l, r, o = {}) => ({
  type: 'box', layout: 'horizontal',
  contents: [txt(l, { flex: 5, size: 'sm', ...o }), txt(r, { flex: 1, size: 'sm', align: 'end', weight: 'bold', ...o })],
});
const btn = (label, data, style = 'secondary') => ({ type: 'button', style, height: 'sm', action: { type: 'postback', label, data } });
const hbox = (contents) => ({ type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'md', contents });
const sep = { type: 'separator', margin: 'md' };
const bubble = (title, bg, fg, body, footer) => ({
  type: 'bubble', size: 'mega',
  header: { type: 'box', layout: 'vertical', backgroundColor: bg, contents: [txt(title, { weight: 'bold', color: fg })] },
  body: { type: 'box', layout: 'vertical', spacing: 'xs', contents: body },
  ...(footer ? { footer: { type: 'box', layout: 'vertical', contents: footer } } : {}),
});

// การ์ดสรุปรายเดือน 1 ใบ (รายการ + รวมถัง + ยอดขายสะสม)
function monthBubble(ym, orders) {
  const body = [];
  let barrels = 0;
  const tally = {};
  if (!orders.length) body.push(txt('ยังไม่มีออเดอร์ในเดือนนี้', { color: '#6B7280' }));
  orders.forEach((o) => {
    // รองรับสถานะปัจจุบัน (ถ้าไม่มีใน SM ให้ fallback ไปที่ order)
    const currentStatus = SM[o.status] ? o.status : 'order';
    const [lab, color] = SM[currentStatus];
    
    body.push({
      type: 'box', layout: 'vertical', spacing: 'xs', margin: 'md',
      contents: [
        txt(`วันที่ ${o.day} : ${lab}`, { weight: 'bold', color }),
        ...o.items.map((i) => row(P[i.pid][0], i.q)),
        // เปลี่ยนจากปุ่มกดวนลูป เป็นชุดปุ่มเลือกสถานะโดยตรง และปุ่มลบ
        hbox([
          btn('รอจัดส่ง', `a=status&o=${o.id}&s=order`),
          btn('จัดส่งแล้ว', `a=status&o=${o.id}&s=delivery`),
          btn('ชำระแล้ว', `a=status&o=${o.id}&s=paid`),
        ]),
        hbox([btn('ลบ', `a=del&o=${o.id}`, 'secondary')]),
      ],
    });
    body.push(sep);
    if (o.status === 'paid') o.items.forEach((i) => { tally[i.pid] = (tally[i.pid] || 0) + i.q; if (P[i.pid][1] === 'd') barrels += i.q; });
  });
  body.push(txt(`รวม ${barrels} ถัง (รับเฉพาะที่ชำระแล้ว)`, { weight: 'bold', margin: 'md' }));
  body.push(sep);
  body.push(txt('📊 ยอดขายสะสม (เฉพาะชำระแล้ว)', { weight: 'bold', margin: 'md' }));
  Object.keys(CATS).forEach((c) => {
    const ps = Object.keys(tally).filter((i) => P[i][1] === c);
    body.push(row(CATS[c], ps.reduce((a, i) => a + tally[i], 0), { weight: 'bold', margin: 'sm' }));
    ps.forEach((i) => body.push(row('• ' + P[i][0], tally[i], { color: '#6B7280' })));
  });
  return bubble(`📋 สรุป Order เดือน ${mlabel(ym)}`, '#06C755', '#04301A', body);
}
const flex = (altText, contents) => ({ type: 'flex', altText, contents });
const monthsMessage = (list) => {
  const bs = list.map(([ym, orders]) => monthBubble(ym, orders));
  return flex(`สรุป Order ${list.map(([ym]) => mlabel(ym)).join(', ')}`, bs.length === 1 ? bs[0] : { type: 'carousel', contents: bs });
};

// การ์ดยืนยันออเดอร์ (มีตัวเลือกเมื่อคำสินค้าไม่ชัด)
function confirmMessage(p, id) {
  const statusKey = SM[p.status] ? p.status : 'order';
  const ready = p.items.length > 0 && p.items.every((i) => i.pid !== null);
  const body = [txt(SM[statusKey][0], { weight: 'bold', color: SM[statusKey][1] })];
  p.items.forEach((i, n) => {
    if (i.pid !== null) return body.push(row(P[i.pid][0], i.q));
    body.push(txt(i.c.length ? `“${i.raw}” ×${i.q} ไม่ชัดเจน เลือกสินค้า:` : `ไม่พบสินค้า “${i.raw}”`, { color: '#B45309', size: 'sm', margin: 'md' }));
    i.c.forEach((c) => body.push(btn(P[c][0], `a=pick&p=${id}&i=${n}&c=${c}`)));
    body.push(btn('ข้ามรายการนี้', `a=skip&p=${id}&i=${n}`));
  });
  body.push(hbox([btn('‹ เดือนก่อน', `a=mm&p=${id}&d=-1`), btn('เดือนถัดไป ›', `a=mm&p=${id}&d=1`)]));
  const footer = [hbox([btn('ยกเลิก', `a=cancel&p=${id}`), ...(ready ? [btn('ยืนยัน', `a=ok&p=${id}`, 'primary')] : [])])];
  return flex(`ยืนยัน Order วันที่ ${p.day}`, bubble(`ยืนยัน Order วันที่ ${p.day} · ${mlabel(p.ym)}`, '#1F2937', '#FFFFFF', body, footer));
}
module.exports = { monthsMessage, confirmMessage };
