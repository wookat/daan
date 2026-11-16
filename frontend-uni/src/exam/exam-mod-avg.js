// R306：模考报告模块得分行的全站同卷模块平均（rank.module_avg），缺数据一律 null 不渲染
export function modAvgPct(rank, key) {
  if (!rank || !rank.module_avg || typeof rank.module_avg !== 'object') return null;
  const m = rank.module_avg[key];
  if (!m || typeof m !== 'object') return null;
  const pct = Number(m.pct);
  const n = Number(m.n_users);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;
  if (!Number.isFinite(n) || n < 2) return null;
  return Math.round(pct);
}
