// 考点掌握度地图 URL 同步：模块 tab 选中态生成可刷新恢复的 hash 深链
export const MASTERY_PATH = '/#/pkgA/stats/mastery-map';

export function buildMasteryUrl(f) {
  const o = f || {};
  const m = typeof o.mod === 'string' ? o.mod.trim() : '';
  return m ? MASTERY_PATH + '?mod=' + encodeURIComponent(m) : MASTERY_PATH;
}

export function parseMasteryOpts(opts) {
  const o = opts || {};
  let mod = '';
  try {
    mod = typeof o.mod === 'string' ? decodeURIComponent(o.mod).trim() : '';
  } catch {
    mod = '';
  }
  return { mod };
}
