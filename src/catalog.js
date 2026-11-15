// สินค้า + การจับคำใกล้เคียง (รองรับพิมพ์เล็ก/ใหญ่ และการเว้นวรรค)
const CATS = { d: 'เบียร์สด (ถัง)', b: 'เบียร์ขวด/กระป๋อง', amenity: 'ยอดเบิก Amenity สะสม', o: 'สินค้าอื่นๆ', support: 'Support' };

const P = [
  // เบียร์สด
  ['Lager สด', 'd', 'ลาเกอร์ draft'], ['Rose สด', 'd', 'โรเซ่ โรเซ draft'], ['Dunkel สด', 'd', 'ดังเคล ดันเคล draft'],
  // เบียร์ขวด/กระป๋อง
  ['Lager ขวด 620ml', 'b', 'ลาเกอร์ bottle'], ['Dunkel ขวด 620ml', 'b', 'ดังเคล ดังเคล bottle'],
  ['Lager กระป๋อง 490ml', 'b', 'ลาเกอร์ can'], ['Dunkel กระป๋อง 490ml', 'b', 'ดังเคล ดังเคล can'],
  ['Weizen กระป๋อง 490ml', 'b', 'ไวเซ่น ไวเซน can'], ['Rose กระป๋อง 490ml', 'b', 'โรเซ่ โรเซ can'],
  ['IPA กระป๋อง 490ml', 'b', 'ไอพีเอ can'], ['PATTAYA กระป๋อง 490ml', 'b', 'พัทยา can'], ['PHUKET กระป๋อง 490ml', 'b', 'ภูเก็ต can'],
  // Amenity
  ['Mug 0.3L', 'amenity', 'mug แก้ว มัค 0.3 m'],
  ['Pine 0.5L', 'amenity', 'pine พายน์ 0.5 p'],
  ['Jug 1L', 'amenity', 'jug เหยือก 1 j'],
  ['Tower 3L', 'amenity', 'tower ทาวเวอร์ 3 t'],
  // สินค้าอื่นๆ
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

// ฟังก์ชันจับคู่สินค้า (รองรับตัวย่อ M, P, J, T และคำว่า support/แถม แบบไม่สนตัวพิมพ์เล็กใหญ่)
function match(raw) {
  let cleanRaw = raw.toLowerCase().trim();
  let isSupport = false;

  if (cleanRaw.startsWith('support') || cleanRaw.startsWith('sup') || cleanRaw.startsWith('แถม')) {
    isSupport = true;
    cleanRaw = cleanRaw.replace(/^(support|sup|แถม)\s*/i, '').trim();
  }

  const r = cleanRaw;
  const codeMap = { l: 0, r: 1, d: 2, m: 12, p: 13, j: 14, t: 15 };
  const code = codeMap[r];
  if (code !== undefined) return { pid: code, c: [], isSupport };
  
  const qs = r.split(/\s+/);
  const sc = PT.map((ts, i) => [i, qs.reduce((a, q) => a + Math.max(...ts.map((t) => sim(q, t))), 0) / qs.length])
    .filter((x) => x[1] >= 0.5).sort((a, b) => b[1] - a[1]);
    
  if (!sc.length) return { pid: null, c: [], isSupport };
  if (sc[0][1] >= 0.9 && (sc.length === 1 || sc[1][1] < sc[0][1] - 0.15)) return { pid: sc[0][0], c: [], isSupport };
  return { pid: null, c: sc.slice(0, 5).map((x) => x[0]), isSupport };
}

// ฟังก์ชันแยกข้อความออเดอร์ (รองรับทั้งรูปแบบวันเดี่ยว และรูปแบบ วว/ดด/ปป เช่น 15/11/26)
function parse(text) {
  const toks = text.trim().split(/\s+/).filter(Boolean);
  if (toks.length === 0) return null;
  
  let day = null;
  let customYm = null;
  let startIndex = 1;

  // ตรวจสอบว่าโทเค็นแรกเป็นรูปแบบวันที่แบบ วว/ดด/ปป หรือ วว/ดด/ปปปป หรือไม่ (เช่น 15/11/26 หรือ 15/11/2026)
  const dateMatch = toks[0].match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dateMatch) {
    day = +dateMatch[1];
    let m = +dateMatch[2];
    let y = +dateMatch[3];
    if (y < 100) y += 2000; // แปลงปี 2 หลัก เช่น 26 เป็น 2026
    if (day < 1 || day > 31 || m < 1 || m > 12) return null;
    customYm = `${y}-${String(m).padStart(2, '0')}`;
  } else if (/^\d{1,2}$/.test(toks[0])) {
    // กรณีพิมพ์มาแค่วันเดี่ยวๆ เช่น "15"
    day = +toks[0];
    if (day < 1 || day > 31) return null;
  } else {
    return null;
  }

  let status = 'order'; // Default เป็นรอจัดส่ง
  const lastToken = toks[toks.length - 1].toLowerCase();
  
  if (lastToken === 'paid') {
    status = 'paid';
    toks.pop();
  } else if (lastToken === 'bill') {
    status = 'delivery'; // bill = รอชำระ (delivery)
    toks.pop();
  }

  const rest = [];
  toks.slice(startIndex).forEach((t) => { 
    const l = t.toLowerCase(); 
    if (ST[l]) {
      status = ST[l]; 
    } else {
      rest.push(t); 
    } 
  });

  const items = [];
  let q = [];
  for (const t of rest) {
    const m = t.match(/^([A-Za-zก-๙.]+)(\d+)$/);
    if (m) { 
      q.push(m[1]); 
      items.push({ raw: q.join(' '), q: +m[2] }); 
      q = []; 
    } else if (/^\d+$/.test(t) && q.length) { 
      items.push({ raw: q.join(' '), q: +t }); 
      q = []; 
    } else {
      q.push(t);
    }
  }
  if (q.length) items.push({ raw: q.join(' '), q: 1 });
  if (!items.length) return null;
  
  items.forEach((it) => {
    const matched = match(it.raw);
    it.pid = matched.pid;
    it.c = matched.c;
    it.isSupport = matched.isSupport;
  });
  
  // ส่งค่า ym กลับไปพร้อมกันด้วย (ถ้ามีระบุมาในแบบ วว/ดด/ปป)
  return { day, ym: customYm, status, items };
}

module.exports = { CATS, P, parse, match };
