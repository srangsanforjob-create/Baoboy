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
  // สร้างตัวเลือก 4 เดือนรอบๆ เดือนปัจจุบันสำหรับปุ่มลัด
  const quickMonths = [
    addMonths(currentYm, -1),
    currentYm,
    addMonths(currentYm, 1),
    addMonths(currentYm, 2)
  ];

  // สร้างปุ่มลัดเดือน/ปี 4 ปุ่ม
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

  // สร้างรายการสินค้าในบิล (ถ้ามีตัวกำกวมจะแสดงปุ่มให้กดเลือก)
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

    // กรณีสินค้ากำกวม (pid === null) ให้สร้างปุ่มตัวเลือกสินค้าขึ้นมาให้กด
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
          // แถวปุ่มเลื่อนเดือน ซ้าย-ขวา
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
          // แถวปุ่มลัดเลือกเดือน/ปี ทันที
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

// 2. การ์ดสรุปยอดรายเดือน (Summary Flex Message)
function monthsMessage(monthList) {
  const bubbles = monthList.map(([ym, orders]) => {
    const statusMap = {
      order: { label: 'รอจัดส่ง', color: '#D97706' },
      delivery: { label: 'รอชำระ', color: '#2563EB' },
      done: { label: 'ส่งแล้ว', color: '#059669' },
      paid: { label: 'จ่ายแล้ว', color: '#16A34A' }
    };

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
                    label: 'เปลี่ยนสถานะ',
                    data: `a=next&o=${o.id}`
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
        contents: orderBoxes
      }
    };
  });

  // ถ้ามีหลายเดือน ส่งเป็น Carousel ให้เลื่อนซ้าย-ขวาได้; ถ้าเดือนเดียวส่งเป็น Bubble เดี่ยว
  return {
    type: 'flex',
    altText: 'สรุปรายการออเดอร์',
    contents: bubbles.length > 1 ? { type: 'carousel', contents: bubbles } : bubbles[0]
  };
}

module.exports = { monthsMessage, confirmMessage };
