// 收藏与笔记页 URL 同步：tab/收藏夹/模块筛选状态生成可刷新恢复的 hash 深链
export const FAVORITES_PATH = '/#/pkgA/social/favorites';

const MODS = ['ziliao', 'shuliang', 'yanyu', 'panduan', 'changshi', '时政'];

export function buildFavoritesUrl(f) {
  const o = f || {};
  const parts = [];
  if (o.tab === 'note') return FAVORITES_PATH + '?tab=note';
  if (MODS.includes(o.mod)) parts.push('mod=' + encodeURIComponent(o.mod));
  const fid = Number(o.folder);
  if (o.folder !== null && o.folder !== undefined && o.folder !== '' && Number.isInteger(fid) && fid >= 0) {
    parts.push('folder=' + fid);
  }
  return parts.length ? FAVORITES_PATH + '?' + parts.join('&') : FAVORITES_PATH;
}

export function parseFavoritesOpts(opts) {
  const o = opts || {};
  let mod = '';
  try {
    mod = typeof o.mod === 'string' ? decodeURIComponent(o.mod) : '';
  } catch {
    mod = '';
  }
  const fid = Number(o.folder);
  return {
    tab: o.tab === 'note' ? 'note' : '',
    mod: MODS.includes(mod) ? mod : '',
    folder: typeof o.folder !== 'undefined' && o.folder !== '' && Number.isInteger(fid) && fid >= 0 ? fid : null,
  };
}
