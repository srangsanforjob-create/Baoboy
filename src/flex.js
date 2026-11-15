const { P } = require('./catalog');
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

// 1. การ์ดยืนยันออเดอร์ + ตัวเลือกเดือน/ปี (Confirm & Month/Year Picker)
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

// 2. การ์ดสรุปยอดรายเดือน พร้อมปุ่มเปลี่ยนสถานะครบถ้วนและยอดรวมด้านล่าง
function monthsMessage(monthList) {
  const bubbles = monthList.map(([ym, orders]) => {
    const statusMap = {
      order: { label: 'รอจัดส่ง', color: '#D97706' },
      delivery: { label: 'รอชำระ', color: '#2563EB' },
      done: { label: 'ส่งแล้ว', color: '#059669' },
      paid: { label: 'จ่ายแล้ว', color: '#16A34A' }
    };

    // คำนวณสรุปยอดรวมสินค้าแต่ละประเภทในเดือนนั้นๆ
    const totals = {};
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
            const name = P[i.pid] ? P[i.pid][0] : 'สินค้า';
            // สะสมยอดรวม
            if (i.pid !== null) {
              if (i.isSupport) {
                supportTotals[i.pid] = (supportTotals[i.pid] || 0) + i.q;
              } else {
                totals[i.pid] = (totals[i.pid] || 0) + i.q;
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
                  style: 'secondary',
                  height: 'sm',
                  action: {
                    type: 'postback',
                    label: 'รอจัดส่ง',
                    data: `a=status&o=${o.id}&s=order`
                  }
                },
                {
                  type: 'button',
                  style: 'secondary',
                  height: 'sm',
                  action: {
                    type: 'postback',
                    label: 'ส่งแล้ว',
                    data: `a=status&o=${o.id}&s=done`
                  }
                },
                {
                  type: 'button',
                  style: 'secondary',
                  height: 'sm',
                  action: {
                    type: 'postback',
                    label: 'จ่ายแล้ว',
                    data: `a=status&o=${o.id}&s=paid`
                  }
                },
                {
                  type: 'button',
                  style: 'secondary',
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

    // สร้างกล่องสรุปยอดรวมสินค้าด้านล่างการ์ด
    const summaryContents = [
      {
        type: 'separator',
        margin: 'md'
      },
      {
        type: 'text',
        text: '📦 ยอดรวมประจำเดือน:',
        weight: 'bold',
        size: 'sm',
        color: '#0F172A',
        margin: 'md'
      }
    ];

    const totalEntries = Object.entries(totals);
    if (totalEntries.length === 0) {
      summaryContents.push({
        type: 'text',
        text: '- ไม่มีข้อมูลยอดรวม -',
        size: 'xs',
        color: '#94A3B8',
        margin: 'xs'
      });
    } else {
      totalEntries.forEach(([pid, qty]) => {
        summaryContents.push({
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
    }

    // แสดงยอด Support (แถม) ถ้ามี
    const supportEntries = Object.entries(supportTotals);
    if (supportEntries.length > 0) {
      summaryContents.push({
        type: 'text',
        text: '🎁 ยอด Support (แถม):',
        weight: 'bold',
        size: 'xs',
        color: '#D97706',
        margin: 'sm'
      });
      supportEntries.forEach(([pid, qty]) => {
        summaryContents.push({
          type: 'box',
          layout: 'horizontal',
          margin: 'xs',
          contents: [
            {
              type: 'text',
              text: P[pid] ? P[pid][0] : 'สินค้า',
              size: 'xs',
              color: '#64748B',
              flex: 4
            },
            {
              type: 'text',
              text: `${qty}`,
              size: 'xs',
              weight: 'bold',
              color: '#D97706',
              align: 'end',
              flex: 1
            }
          ]
        });
      });
    }

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
