// 收藏页列表的本地收缩（与 H5 frontend-uni/src/fav-list.js 同口径）：取消收藏在云端 DELETE 成功后先把该条从
// 手上的列表拿掉、收藏夹计数减一，再后台 load() 全量对账。按对象身份 / id / _lkey 匹配，不按题干。

export interface FavListItem {
  id: number | null;
  _lkey?: string;
  folder_id: number;
}

export interface FavFolderCount {
  id: number;
  n: number;
}

export function dropFavItem<T extends FavListItem, F extends FavFolderCount>(
  items: T[],
  folders: F[],
  it: Pick<FavListItem, 'id' | '_lkey'>,
): { items: T[]; folders: F[] } {
  const list = items || [];
  const hit = list.find((x) => x === it || (it.id != null && x.id === it.id) || (!!it._lkey && x._lkey === it._lkey));
  if (!hit) return { items: list, folders: folders || [] };
  const fid = hit.folder_id || 0;
  return {
    items: list.filter((x) => x !== hit),
    folders: (folders || []).map((f) => (f.id === fid && f.n > 0 ? { ...f, n: f.n - 1 } : f)),
  };
}
