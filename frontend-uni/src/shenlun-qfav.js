// 申论真题收藏：纯函数状态迁移（本地 id 列表 + 展示快照），供收藏视图与星标共用
const QFAV_LIMIT = 200;

export function isQFaved(ids, id) {
  return Array.isArray(ids) && ids.includes(id);
}

export function toggleQFav(state, q) {
  const ids = Array.isArray(state && state.ids) ? state.ids.slice() : [];
  const snaps = Array.isArray(state && state.snaps) ? state.snaps.slice() : [];
  const id = q && Number(q.id);
  if (!Number.isInteger(id) || id <= 0) return { ids, snaps, added: false };
  const i = ids.indexOf(id);
  if (i >= 0) {
    ids.splice(i, 1);
    return { ids, snaps: snaps.filter((x) => x && x.id !== id), added: false };
  }
  ids.push(id);
  snaps.unshift({
    id,
    qtype: q.qtype,
    paper: q.paper,
    exam_year: q.exam_year,
    exam_region: q.exam_region,
    question: q.question,
  });
  if (snaps.length > QFAV_LIMIT) snaps.length = QFAV_LIMIT;
  return { ids, snaps, added: true };
}

// 服务端收藏合并：本地独有条目保留在前并回推服务端，其余以服务端为准
export function mergeQFavSync(local, server) {
  const localIds = Array.isArray(local && local.ids) ? local.ids : [];
  const localSnaps = Array.isArray(local && local.snaps) ? local.snaps : [];
  const serverIds = Array.isArray(server && server.ids) ? server.ids : [];
  const serverItems = Array.isArray(server && server.items) ? server.items : [];
  const pushIds = localIds.filter((id) => !serverIds.includes(id));
  const snaps = [
    ...localSnaps.filter((x) => x && pushIds.includes(x.id)),
    ...serverItems.filter((x) => x && !pushIds.includes(x.id)),
  ];
  if (snaps.length > QFAV_LIMIT) snaps.length = QFAV_LIMIT;
  const have = new Set(snaps.map((x) => x.id));
  const ids = [...snaps.map((x) => x.id), ...localIds.filter((id) => !have.has(id) && !serverIds.includes(id))];
  return { ids, snaps, pushIds };
}

// 历史版本只存 id 不存快照：进收藏视图时需补拉详情的 id 集
export function missingSnapIds(ids, snaps) {
  const have = new Set((Array.isArray(snaps) ? snaps : []).map((x) => x && x.id));
  return (Array.isArray(ids) ? ids : []).filter((id) => !have.has(id));
}
