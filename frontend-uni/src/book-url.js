// 错题本 URL 同步：tab/模块/来源/排序状态生成可刷新恢复的 hash 深链
export const BOOK_PATH = '/#/pages/book/book';

const TABS = ['done', 'fav'];
const MODS = ['ziliao', 'shuliang', 'yanyu', 'panduan', 'changshi', 'shenlun'];
const SRCS = ['exam', 'practice'];
const SORTS = ['due', 'times', 'type', 'reason'];
const RZS = ['粗心大意', '概念不清', '方法不会', '纯蒙的', '未标注'];
const KP_MAX = 40;

function validKp(v) {
  return typeof v === 'string' && v.length > 0 && v.length <= KP_MAX;
}

function parsePid(v) {
  let n = 0;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && /^\d{1,9}$/.test(v)) n = parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export function buildBookUrl(f) {
  const o = f || {};
  const parts = [];
  if (TABS.includes(o.tab)) parts.push('tab=' + o.tab);
  if (o.tab !== 'fav') {
    if (MODS.includes(o.mod)) parts.push('mod=' + o.mod);
    if (validKp(o.kp)) parts.push('kp=' + encodeURIComponent(o.kp));
    if (validKp(o.kp3)) parts.push('kp3=' + encodeURIComponent(o.kp3));
    if (SRCS.includes(o.src)) parts.push('src=' + o.src);
    if (parsePid(o.pid)) parts.push('pid=' + parsePid(o.pid));
    if (RZS.includes(o.rz)) parts.push('rz=' + encodeURIComponent(o.rz));
    if (SORTS.includes(o.sort)) parts.push('sort=' + o.sort);
  }
  return parts.length ? BOOK_PATH + '?' + parts.join('&') : BOOK_PATH;
}

export function parseBookOpts(opts) {
  const o = opts || {};
  let rz = typeof o.rz === 'string' ? o.rz : '';
  try {
    rz = decodeURIComponent(rz);
  } catch (e) {
    rz = '';
  }
  let kp = typeof o.kp === 'string' ? o.kp : '';
  try {
    kp = decodeURIComponent(kp);
  } catch (e) {
    kp = '';
  }
  let kp3 = typeof o.kp3 === 'string' ? o.kp3 : '';
  try {
    kp3 = decodeURIComponent(kp3);
  } catch (e) {
    kp3 = '';
  }
  return {
    tab: TABS.includes(o.tab) ? o.tab : '',
    mod: MODS.includes(o.mod) ? o.mod : '',
    kp: validKp(kp) ? kp : '',
    kp3: validKp(kp3) ? kp3 : '',
    src: SRCS.includes(o.src) ? o.src : '',
    pid: parsePid(o.pid),
    rz: RZS.includes(rz) ? rz : '',
    sort: SORTS.includes(o.sort) ? o.sort : '',
    review: o.review === '1',
  };
}
