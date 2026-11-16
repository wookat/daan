// 学习统计页模考成绩趋势：纯函数（真实已交卷 attempts，<2 条返回 null 不渲染）
import { goalGap } from './exam-goal.js';

export function examTrend(items, target, cap = 10) {
  if (!Array.isArray(items)) return null;
  const pts = items
    .filter((a) => a && a.score != null && Number.isFinite(Number(a.score)) && a.submitted_at)
    .slice(0, cap)
    .reverse()
    .map((a) => ({
      id: a.id,
      score: Math.round(Number(a.score) * 10) / 10,
      kind: a.kind || '',
      t: a.submitted_at
    }));
  if (pts.length < 2) return null;
  const g = goalGap(0, target);
  const t = g ? g.target : null;
  const raw = Math.max(...pts.map((p) => p.score), t || 0, 10);
  const scaleMax = Math.min(100, Math.ceil(raw / 10) * 10);
  return {
    points: pts,
    scaleMax,
    best: Math.max(...pts.map((p) => p.score)),
    latest: pts[pts.length - 1].score,
    target: t,
    targetPct: t && t <= scaleMax ? Math.round((t / scaleMax) * 1000) / 10 : null
  };
}
