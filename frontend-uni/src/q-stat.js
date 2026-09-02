// 题目全站数据锚点行：难度★ · 全站正确率 · 易错项。
// 刷题页/成绩报告解析浮层/错题本共享同一口径：样本 <5 或无聚合值不产出。
export function qStatLine(q) {
  if (!q || !q.attempt_count || q.attempt_count < 5 || q.correct_ratio == null) return '';
  const r = q.correct_ratio;
  const stars = '★'.repeat(r > 85 ? 1 : r > 70 ? 2 : r > 55 ? 3 : r > 40 ? 4 : 5);
  let s = `难度${stars} · 全站正确率 ${r}%（${q.attempt_count} 人次）`;
  if (q.most_wrong && q.most_wrong !== q.answer) s += ` · 易错项 ${q.most_wrong}`;
  return s;
}
