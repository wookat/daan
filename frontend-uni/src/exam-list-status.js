// 真题卷库做题状态本地筛选：todo=没考过（best_score 为空），done=考过的
export function filterPapersByStatus(items, st) {
  if (!Array.isArray(items)) return [];
  if (st !== 'todo' && st !== 'done') return items;
  return items.filter((p) => (st === 'todo' ? p.best_score == null : p.best_score != null));
}
