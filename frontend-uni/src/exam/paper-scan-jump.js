// 对答案结果 sheet「✗」行直达错题卡：只在判分已落库（本次 saved，或 dup=此前同答案已落库）且该行有题库 id、
// 实际作答且答错时可跳，目标是 /api/mistakes 列表里同 question_id 的错题卡（待掌握优先），不新造错题详情路由。
export function scanRowJumpable(res, r) {
  return !!(res && (res.saved || res.dup) && r && r.status === 'ok' && !r.correct && r.question_id);
}

// v-for key 带可跳态：a11y-focus 在挂 click 监听时给宿主补 tabindex/keydown 且不回收，
// 同题号行在「可跳 → 不可跳」两次结果间复用 DOM 会留下无动作的键盘落点；换 key 强制重建节点。
export function scanRowKey(res, r) {
  return String(r && r.no) + (scanRowJumpable(res, r) ? ':jump' : '');
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
