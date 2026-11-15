const { P } = require('./catalog');

const SM = {
  order: ['รอจัดส่ง', '#B45309'],
  delivery: ['จัดส่งแล้วรอชำระ', '#1D4ED8'],
  paid: ['ชำระเงินแล้ว', '#059669'],
};

const CATS = {
  b: 'เบียร์สด (ถัง)',
  a: 'Amenity',
  s: 'Support',
  e: 'Equipment',
  p: 'POSM',
};

function txt(text, opts = {}) {
  return {
    type: 'text',
    text: text,
    size: opts.size || 'sm',
    color: opts.color || '#111827',
    weight: opts.weight || 'regular',
    margin: opts.margin || 'none',
  };
}

function row(label, qty, opts = {}) {
  return {
    type: 'box',
    layout: 'horizontal',
    margin: opts.margin || 'xs',
    contents: [
      { type: 'text', text: label, size: 'sm', color: opts.color || '#374151', flex: 5 },
      { type: 'text', text: String(qty), size: 'sm', color: opts.color || '#111827', align: 'end', flex: 1, weight: opts.weight || 'bold' },
    ],
  };
}

function btn(label, data, style = 'primary', color = undefined, height = 'xs') {
  return {
    type: 'button',
    action: { type: 'postback', label, data },
    style,
    color,
    height,
    flex: 1,
  };
}

function hbox(contents) {
  return { type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'md', contents };
}

const sep = { type: 'separator', margin: 'md' };

function mlabel(ym) {
  const [y, m] = ym.split('-');
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(y, 10) + 543}`;
}

function bubble(title, headerBg, headerTxtColor, bodyContents, footerContents = null) {
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: headerBg,
      contents: [{ type: 'text', text: title, color: headerTxtColor, weight: 'bold', size: 'md' }],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'md',
      contents: bodyContents,
    },
    ...(footerContents ? { footer: { type: 'box', layout: 'vertical', contents: footerContents } } : {}),
  };
}

function monthBubble(ym, orders) {
  const body = [];
  let barrels = 0;
  const tally = {};
  let pendingPaymentCount = 0;
  let supportCount = 0;

  if (!orders || !orders.length) {
    body.push(txt('ยังไม่มีออเดอร์ในเดือนนี้', { color: '#6B7280' }));
  } else {
    orders.forEach((o) => {
      const currentStatus = SM[o.status] ? o.status : 'order';
      const [lab, color] = SM[currentStatus];

      if (o.status === 'delivery') {
        pendingPaymentCount++;
      }

      if (o.items && Array.isArray(o.items)) {
        o.items.forEach((i) => {
          const productCode = i.pid;
          if (productCode && (String(productCode).startsWith('Sup') || i.isSupport || P?.[i.pid]?.[1] === 'support')) {
            supportCount += i.q;
          }
        });
      }

      body.push({
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        margin: 'md',
        contents: [
          txt(`วันที่ ${o.day} : ${lab}`, { weight: 'bold', color }),
          ...(o.items || []).map((i) => {
            let productName = P[i.pid]?.[0] || i.pid;
            if (i.isSupport || String(i.pid).startsWith('Sup')) {
              productName = `Support ${productName}`;
            }
            return row(productName, i.q);
          }),
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            margin: 'sm',
            contents: [
              btn('รอส่ง', `a=status&o=${o.id}&s=order`, 'secondary'),
              btn('ส่งแล้ว', `a=status&o=${o.id}&s=delivery`, 'primary', '#D97706'),
              btn('จ่ายแล้ว', `a=status&o=${o.id}&s=paid`, 'primary', '#059669'),
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'xs',
            contents: [
              btn('ลบ', `a=del&o=${o.id}`, 'link', '#DC2626')
            ],
          },
        ],
      });
      body.push(sep);

      if (o.status === 'paid' && o.items && Array.isArray(o.items)) {
        o.items.forEach((i) => {
          tally[i.pid] = (tally[i.pid] || 0) + i.q;
          if (P[i.pid]?.[1] === 'd') {
            barrels += i.q;
          }
        });
      }
    });
  }

  body.push(txt(`📦 ค้างชำระ: ${pendingPaymentCount} รายการ`, { weight: 'bold', color: '#B45309', margin: 'md' }));
  body.push(txt(`🎁 Support รวม: ${supportCount} ชิ้น`, { weight: 'bold', color: '#D97706', margin: 'sm' }));
  body.push(txt(`รวม ${barrels} ถัง (รับเฉพาะที่ชำระแล้ว)`, { weight: 'bold', margin: 'md' }));
  body.push(sep);
  body.push(txt('📊 ยอดขายสะสม (เฉพาะชำระแล้ว)', { weight: 'bold', margin: 'md' }));

  Object.keys(CATS).forEach((c) => {
    const ps = Object.keys(tally).filter((i) => P[i]?.[1] === c);
    body.push(row(CATS[c], ps.reduce((a, i) => a + tally[i], 0), { weight: 'bold', margin: 'sm' }));
    ps.forEach((i) => body.push(row('• ' + P[i][0], tally[i], { color: '#6B7280' })));
  });

  return bubble(`📋 สรุป Order เดือน ${mlabel(ym)}`, '#06C755', '#04301A', body);
}

const flex = (altText, contents) => ({ type: 'flex', altText, contents });

function monthsMessage(list) {
  const bs = list.map(([ym, orders]) => monthBubble(ym, orders));
  return flex(`สรุป Order ${list.map(([ym]) => mlabel(ym)).join(', ')}`, bs.length === 1 ? bs[0] : { type: 'carousel', contents: bs });
}

function confirmMessage(p, id) {
  const statusKey = SM[p.status] ? p.status : 'order';
  const ready = p.items.length > 0 && p.items.every((i) => i.pid !== null);
  const body = [txt(SM[statusKey][0], { weight: 'bold', color: SM[statusKey][1] })];
  
  p.items.forEach((i, n) => {
    if (i.pid !== null) {
      let productName = P[i.pid]?.[0] || i.pid;
      if (i.isSupport || String(i.pid).startsWith('Sup')) {
        productName = `Support ${productName}`;
      }
      return body.push(row(productName, i.q));
    }
    body.push(txt(i.c && i.c.length ? `“${i.raw}” ×${i.q} ไม่ชัดเจน กรุณาเลือกสินค้า:` : `ไม่พบสินค้า “${i.raw}” กรุณาเลือกสินค้า:`, { color: '#B45309', size: 'sm', margin: 'md' }));
    
    const suggestList = (i.c && Array.isArray(i.c) && i.c.length > 0) ? i.c : P.map((_, idx) => idx).slice(0, 5);
    suggestList.forEach((c) => {
      body.push(btn(P[c]?.[0] || c, `a=pick&p=${id}&i=${n}&c=${c}`, 'secondary'));
    });
  });
  
  body.push(hbox([btn('‹ เดือนก่อน', `a=mm&p=${id}&d=-1`), btn('เดือนถัดไป ›', `a=mm&p=${id}&d=1`)]));
  
  const footer = [hbox([btn('ยกเลิก', `a=cancel&p=${id}`, 'link', '#DC2626'), ...(ready ? [btn('ยืนยัน', `a=ok&p=${id}`, 'primary', '#059669')] : [])])];
  
  return flex(`ยืนยัน Order วันที่ ${p.day}`, bubble(`ยืนยัน Order วันที่ ${p.day} · ${mlabel(p.ym)}`, '#1F2937', '#FFFFFF', body, footer));
}

module.exports = { monthsMessage, confirmMessage };
