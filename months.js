// ตีความ "สรุป Nov", "สรุป พ.ย.", "สรุป พฤศจิกายน 2026", "สรุป 11", "สรุป เดือนหน้า"
const MN = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const ALIAS = [
  ['มกราคม', 'มกรา', 'มค', 'january', 'jan'], ['กุมภาพันธ์', 'กุมภา', 'กพ', 'february', 'feb'],
  ['มีนาคม', 'มีนา', 'มีค', 'march', 'mar'], ['เมษายน', 'เมษา', 'เมย', 'april', 'apr'],
  ['พฤษภาคม', 'พฤษภา', 'พค', 'may'], ['มิถุนายน', 'มิถุนา', 'มิย', 'june', 'jun'],
  ['กรกฎาคม', 'กรกฎา', 'กค', 'july', 'jul'], ['สิงหาคม', 'สิงหา', 'สค', 'august', 'aug'],
  ['กันยายน', 'กันยา', 'กย', 'september', 'sept', 'sep'], ['ตุลาคม', 'ตุลา', 'ตค', 'october', 'oct'],
  ['พฤศจิกายน', 'พฤศจิกา', 'พย', 'november', 'nov'], ['ธันวาคม', 'ธันวา', 'ธค', 'december', 'dec'],
];
const REL = [
  [['นี้', 'ปัจจุบัน', 'this', 'now', 'current'], 0],
  [['หน้า', 'ถัดไป', 'next'], 1],
  [['ที่แล้ว', 'ก่อน', 'last', 'prev', 'previous'], -1],
];
const norm = (s) => s.toLowerCase().replace(/[.\s]/g, '').replace(/^เดือน/, '');
function lev(a, b) {
  const m = [];
  for (let i = 0; i <= a.length; i++) m[i] = [i];
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}
function score(w, a) {
  if (w === a) return 1;
  if (a.length >= 3 && w.length > a.length && w.startsWith(a)) return 0.9;
  if (w.length >= 2 && a.startsWith(w)) return 0.85;
  const d = lev(w, a);
  if (w.length >= 4 && d <= 1) return 0.7;
  if (w.length >= 6 && d <= 2) return 0.6;
  return 0;
}
// 4 หลัก: ค.ศ./พ.ศ. (>2400) | 2 หลัก: 00-59 = 20xx (26 = 2026), 60-99 = พ.ศ. 25xx (69 = 2569 = 2026)
const fixY = (y) => (y > 2400 ? y - 543 : y < 100 ? (y < 60 ? 2000 + y : y + 2500 - 543) : y);
const pad = (n) => String(n).padStart(2, '0');
const idx = (ym) => +ym.slice(0, 4) * 12 + (+ym.slice(5) - 1);
const fromIdx = (i) => `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
const addMonths = (ym, n) => fromIdx(idx(ym) + n);
// เลขเดือนที่ไม่ระบุปี: เลือกปีที่ใกล้ "เดือนนี้" ที่สุด (ให้ความสำคัญกับเดือนที่มีข้อมูล)
function inferYm(m, todayYm, dataYms) {
  const ty = +todayYm.slice(0, 4);
  const cands = [ty - 1, ty, ty + 1].map((y) => `${y}-${pad(m)}`);
  const withData = cands.filter((c) => dataYms.includes(c));
  const pool = withData.length ? withData : cands;
  return pool.sort((a, b) => Math.abs(idx(a) - idx(todayYm)) - Math.abs(idx(b) - idx(todayYm)))[0];
}
// -> {kind:'ok',ym} | {kind:'ask',options:[ym,...]} | {kind:'none'}
function resolveMonth(rest, todayYm, dataYms = []) {
  const toks = rest.trim().split(/\s+/).filter(Boolean);
  let year = null, mnum = null;
  const words = [], nums = [];
  for (const t of toks) {
    let m;
    if ((m = t.match(/^(\d{4})[/-](\d{1,2})$/))) { year = fixY(+m[1]); mnum = +m[2]; }
    else if ((m = t.match(/^(\d{1,2})[/-](\d{2,4})$/))) { mnum = +m[1]; year = fixY(+m[2]); }
    else if (/^\d{4}$/.test(t)) year = fixY(+t);
    else if (/^\d{1,2}$/.test(t)) nums.push(+t);
    else if ((m = t.match(/^(\D+?)(\d{2}|\d{4})$/))) { words.push(m[1]); year = fixY(+m[2]); } // พ.ย.26, nov2026
    else words.push(t);
  }
  if (words.length) { if (nums.length && year === null) year = fixY(nums[0]); } // มีชื่อเดือน: เลขที่ตามมา = ปี
  else if (nums.length) { mnum = nums[0]; if (nums.length > 1 && year === null) year = fixY(nums[1]); } // "11 26" = เดือน 11 ปี 2026
  const toYm = (m) => (year ? `${year}-${pad(m)}` : inferYm(m, todayYm, dataYms));
  if (words.length) {
    const w = norm(words.join(''));
    for (const [keys, n] of REL) if (keys.some((k) => w === k || w.includes(k))) return { kind: 'ok', ym: addMonths(todayYm, n) };
    const sc = ALIAS.map((al, i) => [i + 1, Math.max(...al.map((a) => score(w, a)))])
      .filter((x) => x[1] >= 0.5).sort((a, b) => b[1] - a[1]);
    if (!sc.length) return { kind: 'none' };
    const [best, second] = sc;
    if (best[1] >= 0.85 && (!second || second[1] <= best[1] - 0.15)) return { kind: 'ok', ym: toYm(best[0]) };
    return { kind: 'ask', options: sc.slice(0, 4).map((x) => toYm(x[0])) };
  }
  if (mnum !== null) return mnum >= 1 && mnum <= 12 ? { kind: 'ok', ym: toYm(mnum) } : { kind: 'none' };
  return { kind: 'none' };
}
const mlabel = (ym) => `${MN[+ym.slice(5) - 1]} ${ym.slice(0, 4)}`;
module.exports = { resolveMonth, addMonths, mlabel, MN };
