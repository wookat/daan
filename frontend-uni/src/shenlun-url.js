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

export function buildShenlunMatUrl(id, type) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return SHENLUN_PATH + '?tab=m';
  const t = typeof type === 'string' && type ? '&mtype=' + encodeURIComponent(type) : '';
  return SHENLUN_PATH + '?tab=m&mid=' + n + t;
}
