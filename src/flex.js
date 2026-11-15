// src/flex.js

const SM = {
  order: ['รอจัดส่ง', '#B45309'],      // สีส้มเข้ม
  delivery: ['จัดส่งแล้วรอชำระ', '#1D4ED8'], // สีน้ำเงิน
  paid: ['ชำระเงินแล้ว', '#059669']    // สีเขียว
};

const CATS = {
  b: 'เบียร์สด (ถัง)',
  a: 'Amenity',
  s: 'Support',
  e: 'Equipment',
  p: 'POSM'
};

function txt(text, opts = {}) {
  return {
    type: 'text',
    text: text,
    size: opts.size || 'sm',
    color: opts.color || '#111827',
    weight: opts.weight || 'regular',
    margin: opts.margin || 'none'
  };
}

function row(label, qty, opts = {}) {
  return {
    type: 'box',
    layout: 'horizontal',
    margin: opts.margin || 'xs',
    contents: [
      { type: 'text', text: label, size: 'sm', color: opts.color || '#374151', flex: 5 },
      { type: 'text', text: String(qty), size: 'sm', color: opts.color || '#111827', align: 'end', flex: 1, weight: opts.weight || 'bold' }
    ]
  };
}

function btn(label, data, style = 'primary', color = undefined) {
  return {
    type: 'button',
    action: {
      type: 'postback',
      label: label,
      data: data
    },
    style: style,
    color: color,
    height: 'sm',
    flex: 1
  };
}

const sep = { type: 'separator', margin: 'md' };

function mlabel(ym) {
  const [y, m] = ym.split('-');
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(y, 10) + 543}`;
}

function bubble(title, headerBg, headerTxtColor, bodyContents) {
  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: headerBg,
      contents: [
        {
          type: 'text',
          text: title,
          color: headerTxtColor,
          weight: 'bold',
          size: 'md'
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: bodyContents
    }
  };
}

function monthBubble(ym, orders) {
  const body = [];
  let barrels = 0;
  const tally = {};
  let pendingPaymentCount = 0; // ตัวนับออเดอร์ค้างชำระ (สถานะ delivery)
  let supportCount = 0;        // ตัวนับจำนวนสินค้า Support รวม

  if (!orders.length) {
    body.push(txt('ยังไม่มีออเดอร์ในเดือนนี้', { color: '#6B7280' }));
  }

  orders.forEach((o) => {
    const currentStatus = SM[o.status] ? o.status : 'order';
    const [lab, color] = SM[currentStatus];
    
    // นับออเดอร์ที่อยู่ในสถานะจัดส่งแล้วรอชำระ (delivery)
    if (o.status === 'delivery') {
      pendingPaymentCount++;
    }

    // ตรวจสอบและนับจำนวนสินค้าที่เป็น Support
    o.items.forEach((i) => {
      const productCode = i.pid;
      if (productCode && (productCode.startsWith('Sup') || P[i.pid][1] === 'support')) {
        supportCount += i.q;
      }
    });

    body.push({
      type: 'box',
      layout: 'vertical',
      spacing: 'xs',
      margin: 'md',
      contents: [
        txt(`วันที่ ${o.day} : ${lab}`, { weight: 'bold', color }),
        ...o.items.map((i) => row(P[i.pid][0], i.q)),
        // แถวปุ่มสถานะแบบสั้นและมีสีสัน
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          margin: 'sm',
          contents: [
            btn('รอส่ง', `a=status&o=${o.id}&s=order`, 'secondary'),
            btn('ส่งแล้ว', `a=status&o=${o.id}&s=delivery`, 'primary', '#D97706'), // สีส้ม
            btn('จ่ายแล้ว', `a=status&o=${o.id}&s=paid`, 'primary', '#059669')    // สีเขียว
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'xs',
          contents: [
            btn('ลบ', `a=del&o=${o.id}`, 'link', '#DC2626') // ปุ่มลบสีแดง
          ]
        }
      ],
    });
    body.push(sep);

    // คำนวณยอดขายเฉพาะออเดอร์ที่จ่ายเงินแล้ว (paid)
    if (o.status === 'paid') {
      o.items.forEach((i) => {
        tally[i.pid] = (tally[i.pid] || 0) + i.q;
        if (P[i.pid][1] === 'd') {
          barrels += i.q;
        }
      });
    }
  });

  // ส่วนสรุปท้ายการ์ด (Summary Section)
  body.push(txt(`📦 ค้างชำระ: ${pendingPaymentCount} รายการ`, { weight: 'bold', color: '#B45309', margin: 'md' }));
  body.push(txt(`🎁 Support รวม: ${supportCount} ชิ้น`, { weight: 'bold', color: '#D97706', margin: 'sm' }));
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

module.exports = { monthBubble };
