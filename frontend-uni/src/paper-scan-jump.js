// 对答案结果 sheet「✗」行直达错题卡：只在本次判分已落库（saved）且该行有题库 id、实际作答且答错时可跳，
// 目标是 /api/mistakes 列表里同 question_id 的错题卡（待掌握优先），不新造错题详情路由。
export function scanRowJumpable(res, r) {
  return !!(res && res.saved && r && r.status === 'ok' && !r.correct && r.question_id);
}

export function findScanMistake(items, qid) {
  const id = Number(qid) || 0;
  if (!id || !Array.isArray(items)) return null;
  const hits = items.filter((m) => m && Number(m.question_id) === id);
  return hits.find((m) => !m.mastered) || hits[0] || null;
}

// 列表分页步长 20：让目标卡进入已渲染范围（idx 从 0 起；不在列表里返回原 pageN）
export function pageNFor(idx, pageN, step = 20) {
  if (idx < 0) return pageN;
  return Math.max(pageN, Math.ceil((idx + 1) / step) * step);
}
