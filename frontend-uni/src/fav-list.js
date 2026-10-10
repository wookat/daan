// 收藏页列表的本地收缩：取消收藏在云端 DELETE 成功后先把该条从手上的列表拿掉、收藏夹计数减一，
// 再后台 load() 全量对账——不等对账回包也不铺骨架。按对象身份 / id / _lkey 匹配，不按题干（同题干本机+云端两条时只删被点的那条）。

export function dropFavItem(items, folders, it) {
  const list = items || [];
  const hit = list.find((x) => x === it || (it.id != null && x.id === it.id) || (it._lkey && x._lkey === it._lkey));
  if (!hit) return { items: list, folders: folders || [] };
  const fid = hit.folder_id || 0;
  return {
    items: list.filter((x) => x !== hit),
    folders: (folders || []).map((f) => (f.id === fid && f.n > 0 ? { ...f, n: f.n - 1 } : f)),
  };
}
