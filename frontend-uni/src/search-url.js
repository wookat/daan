// 搜索页 URL 同步：由当前关键词/tab 生成可分享的 hash 深链
export const SEARCH_PATH = '/#/pkgA/search/search';

// 行测题目公开页路径：/tiku/q/{id}/（非法 id 回落题库首页）
export function buildTikuQPath(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return '/tiku/';
  return '/tiku/q/' + n + '/';
}

export function buildSearchUrl(kw, tab) {
  const q = String(kw || '').trim();
  if (!q) return SEARCH_PATH;
  let url = SEARCH_PATH + '?q=' + encodeURIComponent(q.slice(0, 64));
  if (tab && tab !== 'all') url += '&tab=' + tab;
  return url;
}
