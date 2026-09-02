// 申论专区 URL 同步：由当前详情题 id 生成可分享的 hash 深链
export const SHENLUN_PATH = '/#/pkgA/shenlun/shenlun';

export function buildShenlunUrl(id) {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? SHENLUN_PATH + '?id=' + n : SHENLUN_PATH;
}

export function buildShenlunPaperUrl(paper) {
  if (typeof paper !== 'string' || !paper || paper.length > 100) return SHENLUN_PATH;
  return SHENLUN_PATH + '?paper=' + encodeURIComponent(paper);
}

export function buildShenlunFilterUrl(f) {
  const o = f || {};
  const parts = [];
  if (typeof o.paper === 'string' && o.paper && o.paper.length <= 100) parts.push('paper=' + encodeURIComponent(o.paper));
  if (typeof o.qtype === 'string' && o.qtype && o.qtype !== '全部') parts.push('qtype=' + encodeURIComponent(o.qtype));
  const y = Number(o.year);
  if (Number.isInteger(y) && y > 0) parts.push('year=' + y);
  if (typeof o.region === 'string' && o.region) parts.push('region=' + encodeURIComponent(o.region));
  return parts.length ? SHENLUN_PATH + '?' + parts.join('&') : SHENLUN_PATH;
}

export function buildShenlunTabUrl(tab, mtype, fav) {
  if (tab === 'r') return SHENLUN_PATH + '?tab=r';
  if (tab !== 'm') return SHENLUN_PATH;
  if (fav) return SHENLUN_PATH + '?tab=m&fav=1';
  const t = typeof mtype === 'string' && mtype && mtype !== '全部' ? '&mtype=' + encodeURIComponent(mtype) : '';
  return SHENLUN_PATH + '?tab=m' + t;
}

export function buildShenlunMatUrl(id, type) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return SHENLUN_PATH + '?tab=m';
  const t = typeof type === 'string' && type ? '&mtype=' + encodeURIComponent(type) : '';
  return SHENLUN_PATH + '?tab=m&mid=' + n + t;
}
