// 搜索页 URL 同步：由当前关键词/tab 生成可分享的 hash 深链
export const SEARCH_PATH = '/#/pkgA/search/search';

export function buildSearchUrl(kw, tab) {
  const q = String(kw || '').trim();
  if (!q) return SEARCH_PATH;
  let url = SEARCH_PATH + '?q=' + encodeURIComponent(q.slice(0, 64));
  if (tab && tab !== 'all') url += '&tab=' + tab;
  return url;
}
