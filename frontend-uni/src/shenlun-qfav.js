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

// 历史版本只存 id 不存快照：进收藏视图时需补拉详情的 id 集
export function missingSnapIds(ids, snaps) {
  const have = new Set((Array.isArray(snaps) ? snaps : []).map((x) => x && x.id));
  return (Array.isArray(ids) ? ids : []).filter((id) => !have.has(id));
}
