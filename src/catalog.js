// สินค้า + การจับคำใกล้เคียง (ไทย/อังกฤษ/พิมพ์ผิด) + แยกข้อความออเดอร์
const CATS = { d: 'เบียร์สด (ถัง)', b: 'เบียร์ขวด/กระป๋อง', o: 'สินค้าอื่นๆ', support: 'Support' };
// [ชื่อ, หมวด, คีย์เวิร์ดเพิ่มเติม]  (index 0,1,2 = L,R,D)
const P = [
  ['Lager สด', 'd', 'ลาเกอร์ draft'], ['Rose สด', 'd', 'โรเซ่ โรเซ draft'], ['Dunkel สด', 'd', 'ดังเคล ดันเคล draft'],
  ['Lager ขวด 620ml', 'b', 'ลาเกอร์ bottle'], ['Dunkel ขวด 620ml', 'b', 'ดังเคล ดังเคล bottle'],
  ['Lager กระป๋อง 490ml', 'b', 'ลาเกอร์ can'], ['Dunkel กระป๋อง 490ml', 'b', 'ดังเคล ดันเคล can'],
  ['Weizen กระป๋อง 490ml', 'b', 'ไวเซ่น ไวเซน can'], ['Rose กระป๋อง 490ml', 'b', 'โรเซ่ โรเซ can'],
  ['IPA กระป๋อง 490ml', 'b', 'ไอพีเอ can'], ['PATTAYA กระป๋อง 490ml', 'b', 'พัทยา can'], ['PHUKET กระป๋อง 490ml', 'b', 'ภูเก็ต can'],
  ['บรั่นดี Galaxy แบน 350ml', 'o', 'brandy กาแลคซี่ แบน flat'], ['บรั่นดี Galaxy กลม 700ml', 'o', 'brandy กาแลคซี่ กลม round'],
  ['เหล้าบ๊วย Kacha 375ml', 'o', 'คาชา บ๊วย plum'],
  ['Whisky TENDO 350ml', 'o', 'วิสกี้ เท็นโด เทนโด'], ['Whisky TENDO 700ml', 'o', 'วิสกี้ เท็นโด เทนโด'],
  ['Whisky ร.ศ. 158 700ml', 'o', 'วิสกี้ รัตนโกสินทร์'],
  ['Soju Taeyang โยเกิร์ต 360ml', 'o', 'โซจู แทยัง yogurt'], ['Soju Taeyang พีช 360ml', 'o', 'โซจู แทยัง peach'],
  ['Soju Taeyang องุ่น 360ml', 'o', 'โซจู แทยัง grape'], ['Soju Taeyang สตรอเบอรี่ 360ml', 'o', 'โซจู แทยัง strawberry'],
  ['Soju Taeyang เกรปฟรุ๊ต 360ml', 'o', 'โซจู แทยัง grapefruit'],
];
const PT = P.map((p) => (p[0] + ' ' + p[2]).toLowerCase().split(/\s+/));
const ST = {
  order: 'order', ออเดอร์: 'order', ออเดอ: 'order',
  done: 'done', เสร็จ: 'done', ส่งแล้ว: 'done', จัดส่ง: 'done',
  paid: 'paid', จ่ายแล้ว: 'paid', ชำระ: 'paid', ชำระแล้ว: 'paid',
};

function lev(a, b) {
  const m = [];
  for (let i = 0; i <= a.length; i++) m[i] = [i];
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}
function sim(q, t) {
  if (q === t) return 1;
  if (q.length >= 2 && t.startsWith(q)) return 0.9;
  if (q.length >= 3 && t.includes(q)) return 0.75;
  const d = lev(q, t);
  if (q.length >= 4 && d <= 1) return 0.7;
  if (q.length >= 6 && d <= 2) return 0.55;
  return 0;
}

// ฟังก์ชันจับคู่สินค้า พร้อมตรวจจับคำว่า support, sup, แถม
function match(raw) {
  let cleanRaw = raw.toLowerCase().trim();
  let isSupport = false;

  if (cleanRaw.startsWith('support') || cleanRaw.startsWith('sup') || cleanRaw.startsWith('แถม')) {
    isSupport = true;
    cleanRaw = cleanRaw.replace(/^(support|sup|แถม)\s*/i, '').trim();
  }

  const r = cleanRaw;
  const code = { l: 0, r: 1, d: 2 }[r];
  if (code !== undefined) return { pid: code, c: [], isSupport };
  
  const qs = r.split(/\s+/);
  const sc = PT.map((ts, i) => [i, qs.reduce((a, q) => a + Math.max(...ts.map((t) => sim(q, t))), 0) / qs.length])
    .filter((x) => x[1] >= 0.5).sort((a, b) => b[1] - a[1]);
    
  if (!sc.length) return { pid: null, c: [], isSupport };
  if (sc[0][1] >= 0.9 && (sc.length === 1 || sc[1][1] < sc[0][1] - 0.15)) return { pid: sc[0][0], c: [], isSupport };
  return { pid: null, c: sc.slice(0, 5).map((x) => x[0]), isSupport };
}

// แยกข้อความออเดอร์
function parse(text) {
  const toks = text.trim().split(/\s+/);
  if (!/^\d{1,2}$/.test(toks[0])) return null;
  const day = +toks[0];
  if (day < 1 || day > 31) return null;
  let status = 'order';
  const rest = [];
  toks.slice(1).forEach((t) => { const l = t.toLowerCase(); if (ST[l]) status = ST[l]; else rest.push(t); });
  const items = [];
  let q = [];
  for (const t of rest) {
    const m = t.match(/^([A-Za-zก-๙.]+)(\d+)$/);
    if (m) { q.push(m[1]); items.push({ raw: q.join(' '), q: +m[2] }); q = []; }
    else if (/^\d+$/.test(t) && q.length) { items.push({ raw: q.join(' '), q: +t }); q = []; }
    else q.push(t);
  }
  if (q.length) items.push({ raw: q.join(' '), q: 1 });
  if (!items.length) return null;
  
  items.forEach((it) => {
    const matched = match(it.raw);
    it.pid = matched.pid;
    it.c = matched.c;
    it.isSupport = matched.isSupport;
  });
  
  return { day, status, items };
}

module.exports = { CATS, P, parse, match };
