// 真题卷库刷卷进度：done=考过（best_score 非空，0 分算考过），fail-closed
export function paperProgress(items) {
  if (!Array.isArray(items)) return { done: 0, total: 0, pct: 0 };
  const total = items.length;
  const done = items.filter((p) => p && p.best_score != null).length;
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}
