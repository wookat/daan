// 模考成绩报告个人锚点：目标分对比 + 较上次同卷成绩（纯函数，缺数据一律返回 null 不渲染）

export function goalGap(score, target) {
  const s = Number(score);
  const t = Number(target);
  if (score == null || target == null || !Number.isFinite(s) || !Number.isFinite(t) || t <= 0) return null;
  return { target: t, gap: Math.round((t - s) * 10) / 10 };
}

export function prevScoreDelta(history, curId) {
  if (!Array.isArray(history) || curId == null) return null;
  const i = history.findIndex((a) => a && a.id === curId);
  if (i <= 0) return null;
  const prev = history[i - 1];
  const cur = history[i];
  if (!prev || prev.score == null || !cur || cur.score == null) return null;
  return { prev: Number(prev.score), delta: Math.round((Number(cur.score) - Number(prev.score)) * 10) / 10 };
}
