const { P, CATS } = require('./catalog');
const { addMonths } = require('./months');

const thaiMonthsFull = [
  '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const thaiMonthsShort = [
  '', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

function formatMonthFull(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${thaiMonthsFull[parseInt(m, 10)]} ${y}`;
}

function formatMonthShort(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${thaiMonthsShort[parseInt(m, 10)]} ${y.slice(-2)}`;
}

// 1. การ์ดยืนยันออเดอร์ + ตัวเลือกเดือน/ปี
function confirmMessage(order, pendingId) {
  const currentYm = order.ym;
  const quickMonths = [
    addMonths(currentYm, -1),
    currentYm,
    addMonths(currentYm, 1),
    addMonths(currentYm, 2)
  ];

  const quickMonthButtons = quickMonths.map((ym) => {
    const isSelected = ym === currentYm;
    return {
      type: 'button',
      style: isSelected ? 'primary' : 'secondary',
      color: isSelected ? '#1DB446' : '#E2E8F0',
      height: 'sm',
      action: {
        type: 'postback',
        label: formatMonthShort(ym),
        data: `a=setym&p=${pendingId}&ym=${ym}`
      }
    };
  });

  const itemRows = [];
  order.items.forEach((item, idx) => {
    const prodName = item.pid !== null ? P[item.pid][0] : `❓ "${item.raw}" (เลือกสินค้า)`;
    itemRows.push({
      type: 'box',
      layout: 'horizontal',
      margin: 'sm',
      contents: [
        {
          type: 'text',
          text: `${prodName}${item.isSupport ? ' [แถม]' : ''}`,
          size: 'sm',
          color: item.pid !== null ? '#1E293B' : '#DC2626',
          weight: item.pid !== null ? 'regular' : 'bold',
          flex: 4,
          wrap: true
        },
        {
          type: 'text',
          text: `x${item.q}`,
          size: 'sm',
          color: '#475569',
          weight: 'bold',
          align: 'end',
          flex: 1
        }
      ]
    });

    if (item.pid === null && item.c && item.c.length > 0) {
      const choiceButtons = item.c.slice(0, 3).map((cid) => ({
        type: 'button',
        style: 'secondary',
        height: 'sm',
        margin: 'xs',
        action: {
          type: 'postback',
          label: P[cid][0].slice(0, 20),
          data: `a=pick&p=${pendingId}&i=${idx}&c=${cid}`
        }
      }));
      itemRows.push({
        type: 'box',
        layout: 'vertical',
        margin: 'xs',
        contents: choiceButtons
      });
    }
  });

  return {
    type: 'flex',
    altText: `ยืนยันออเดอร์วันที่ ${order.day} (${formatMonthFull(currentYm)})`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0F172A',
        paddingAll: 'md',
        contents: [
          {
            type: 'text',
            text: '📅 ระบุเดือน/ปี และตรวจสอบรายการ',
            color: '#94A3B8',
            size: 'xs',
            weight: 'bold'
          },
          {
            type: 'text',
            text: `วันที่ ${order.day} ${formatMonthFull(currentYm)}`,
            color: '#FFFFFF',
            size: 'lg',
            weight: 'bold',
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'button',
                style: 'secondary',
                height: 'sm',
                action: {
                  type: 'postback',
                  label: '◀ เดือนก่อน',
                  data: `a=mm&p=${pendingId}&d=-1`
                }
              },
              {
                type: 'button',
                style: 'secondary',
                height: 'sm',
                action: {
                  type: 'postback',
                  label: 'เดือนหน้า ▶',
                  data: `a=mm&p=${pendingId}&d=1`
                }
              }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'xs',
            margin: 'sm',
            contents: quickMonthButtons
          },
          {
            type: 'separator',
            margin: 'md'
          },
          {
            type: 'text',
            text: 'รายการสินค้า:',
            size: 'xs',
            color: '#64748B',
            weight: 'bold',
            margin: 'md'
          },
          ...itemRows
        ]
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'postback',
              label: '❌ ยกเลิก',
              data: `a=cancel&p=${pendingId}`
            }
          },
          {
            type: 'button',
            style: 'primary',
            color: '#1DB446',
            action: {
              type: 'postback',
              label: '✅ ยืนยันบันทึก',
              data: `a=ok&p=${pendingId}`
            }
          }
        ]
      }
    }
  };
}

// 2. การ์ดสรุปยอดรายเดือน (รอจัดส่ง: ส้ม | รอชำระ: แดง | ชำระแล้ว: เขียว)
function monthsMessage(monthList) {
  const bubbles = monthList.map(([ym, orders]) => {
    const statusMap = {
      order: { label: 'รอจัดส่ง', color: '#D97706' },
      delivery: { label: 'รอชำระ', color: '#DC2626' },
      paid: { label: 'ชำระแล้ว', color: '#16A34A' }
    };

    const normalTotals = {};
    const amenityTotals = {};
    const supportTotals = {};

    const orderBoxes = [];
    if (!orders || orders.length === 0) {
      orderBoxes.push({
        type: 'text',
        text: 'ยังไม่มีรายการออเดอร์ในเดือนนี้',
        size: 'sm',
        color: '#94A3B8',
        align: 'center',
        margin: 'lg'
      });
    } else {
      orders.forEach((o) => {
        const st = statusMap[o.status] || { label: o.status, color: '#64748B' };
        const itemsDesc = o.items
          .map((i) => {
            const prod = P[i.pid];
            const name = prod ? prod[0] : 'สินค้า';
            const cat = prod ? prod[1] : 'o';

            if (i.pid !== null) {
              if (i.isSupport) {
                supportTotals[i.pid] = (supportTotals[i.pid] || 0) + i.q;
              } else if (cat === 'amenity') {
                amenityTotals[i.pid] = (amenityTotals[i.pid] || 0) + i.q;
              } else {
                normalTotals[i.pid] = (normalTotals[i.pid] || 0) + i.q;
              }
            }
            return `${name} x${i.q}${i.isSupport ? ' (แถม)' : ''}`;
          })
          .join('\n');

        orderBoxes.push({
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#F8FAFC',
          cornerRadius: 'md',
          paddingAll: 'sm',
          margin: 'sm',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: `วันที่ ${o.day}`,
                  weight: 'bold',
                  size: 'sm',
                  color: '#0F172A',
                  flex: 2
                },
                {
                  type: 'text',
                  text: `● ${st.label}`,
                  size: 'xs',
                  weight: 'bold',
                  color: st.color,
                  align: 'end',
                  flex: 3
                }
              ]
            },
            {
              type: 'text',
              text: itemsDesc,
              size: 'xs',
              color: '#334155',
              wrap: true,
              margin: 'xs'
            },
            {
              type: 'box',
              layout: 'horizontal',
              spacing: 'xs',
              margin: 'sm',
              contents: [
                {
                  type: 'button',
                  style: o.status === 'order' ? 'primary' : 'secondary',
                  color: o.status === 'order' ? '#D97706' : '#F1F5F9',
                  height: 'sm',
                  action: {
                    type: 'postback',
                    label: 'รอจัดส่ง',
                    data: `a=status&o=${o.id}&s=order`
                  }
                },
                {
                  type: 'button',
                  style: o.status === 'delivery' ? 'primary' : 'secondary',
                  color: o.status === 'delivery' ? '#DC2626' : '#F1F5F9',
                  height: 'sm',
                  action: {
                    type: 'postback',
                    label: 'รอชำระ',
                    data: `a=status&o=${o.id}&s=delivery`
                  }
                },
                {
                  type: 'button',
                  style: o.status === 'paid' ? 'primary' : 'secondary',
                  color: o.status === 'paid' ? '#16A34A' : '#F1F5F9',
                  height: 'sm',
                  action: {
                    type: 'postback',
                    label: 'ชำระแล้ว',
                    data: `a=status&o=${o.id}&s=paid`
                  }
                },
                {
                  type: 'button',
                  style: 'secondary',
                  color: '#E2E8F0',
                  height: 'sm',
                  action: {
                    type: 'postback',
                    label: 'ลบ',
                    data: `a=del&o=${o.id}`
                  }
                }
              ]
            }
          ]
        });
      });
    }

    const buildCategorySummary = (title, color, totalsObj) => {
      const entries = Object.entries(totalsObj);
      if (entries.length === 0) return [];

      const boxContents = [
        {
          type: 'text',
          text: title,
          weight: 'bold',
          size: 'xs',
          color: color,
          margin: 'md'
        }
      ];

      entries.forEach(([pid, qty]) => {
        boxContents.push({
          type: 'box',
          layout: 'horizontal',
          margin: 'xs',
          contents: [
            {
              type: 'text',
              text: P[pid] ? P[pid][0] : 'สินค้า',
              size: 'xs',
              color: '#334155',
              flex: 4
            },
            {
              type: 'text',
              text: `${qty}`,
              size: 'xs',
              weight: 'bold',
              color: '#0F172A',
              align: 'end',
              flex: 1
            }
          ]
        });
      });

      return boxContents;
    };

    const summaryContents = [
      {
        type: 'separator',
        margin: 'md'
      },
      {
        type: 'text',
        text: '📊 ยอดรวมประจำเดือน',
        weight: 'bold',
        size: 'sm',
        color: '#0F172A',
        margin: 'md'
      },
      ...buildCategorySummary('📦 สินค้าปกติ:', '#0F172A', normalTotals),
      ...buildCategorySummary('🍺 ยอดเบิก Amenity:', '#2563EB', amenityTotals),
      ...buildCategorySummary('🎁 ยอด Support (ของแถม):', '#D97706', supportTotals)
    ];

    return {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1DB446',
        paddingAll: 'md',
        contents: [
          {
            type: 'text',
            text: `📊 สรุปออเดอร์ประจำเดือน`,
            color: '#DCFCE7',
            size: 'xs',
            weight: 'bold'
          },
          {
            type: 'text',
            text: formatMonthFull(ym),
            color: '#FFFFFF',
            size: 'lg',
            weight: 'bold',
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          ...orderBoxes,
          ...summaryContents
        ]
      }
    };
  });

  return {
    type: 'flex',
    altText: 'สรุปรายการออเดอร์',
    contents: bubbles.length > 1 ? { type: 'carousel', contents: bubbles } : bubbles[0]
  };
}

module.exports = { monthsMessage, confirmMessage };
