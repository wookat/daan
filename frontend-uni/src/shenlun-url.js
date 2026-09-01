// 申论专区 URL 同步：由当前详情题 id 生成可分享的 hash 深链
export const SHENLUN_PATH = '/#/pkgA/shenlun/shenlun';

export function buildShenlunUrl(id) {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? SHENLUN_PATH + '?id=' + n : SHENLUN_PATH;
}
