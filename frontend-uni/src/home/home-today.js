// 首页「今日已练」展示值：服务端 summary.today_n（answer_log，按 uid）为准，
// 叠加本机 pstats.days[today] 自上次同步以来的增量；无服务端值时降级为本地数。
export function todayShown(svTodayN, svLocalAtSync, localNow) {
  const local = Math.max(0, Number(localNow) || 0);
  if (typeof svTodayN !== 'number' || !Number.isFinite(svTodayN)) return local;
  return svTodayN + Math.max(0, local - Math.max(0, Number(svLocalAtSync) || 0));
}
