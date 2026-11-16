// 申论详情连看：在当前列表上下文（含收藏视图）内定位上一题/下一题
export function qNavState(ids, curId) {
  const list = Array.isArray(ids) ? ids : [];
  const i = list.indexOf(curId);
  if (i < 0) return { idx: -1, total: list.length, prevId: 0, nextId: 0 };
  return {
    idx: i,
    total: list.length,
    prevId: i > 0 ? list[i - 1] : 0,
    nextId: i < list.length - 1 ? list[i + 1] : 0,
  };
}
