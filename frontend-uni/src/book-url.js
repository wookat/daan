// 错题本 URL 同步：tab/模块/来源/排序状态生成可刷新恢复的 hash 深链
export const BOOK_PATH = '/#/pages/book/book';

const TABS = ['done', 'fav'];
const MODS = ['ziliao', 'shuliang', 'yanyu', 'panduan', 'changshi', 'shenlun'];
const SRCS = ['exam', 'practice'];
const SORTS = ['due', 'times', 'type', 'reason'];
const RZS = ['粗心大意', '概念不清', '方法不会', '纯蒙的', '未标注'];

export function buildBookUrl(f) {
  const o = f || {};
  const parts = [];
  if (TABS.includes(o.tab)) parts.push('tab=' + o.tab);
  if (o.tab !== 'fav') {
    if (MODS.includes(o.mod)) parts.push('mod=' + o.mod);
    if (SRCS.includes(o.src)) parts.push('src=' + o.src);
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
  return {
    tab: TABS.includes(o.tab) ? o.tab : '',
    mod: MODS.includes(o.mod) ? o.mod : '',
    src: SRCS.includes(o.src) ? o.src : '',
    rz: RZS.includes(rz) ? rz : '',
    sort: SORTS.includes(o.sort) ? o.sort : '',
    review: o.review === '1',
  };
}
