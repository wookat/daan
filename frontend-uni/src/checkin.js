// 打卡/刷题数统一口径：当天练过任意题（专项练习或模考均计入）即打卡，
// 数据源统一为本地 pstats（服务端 answer_log 与其同步写入）。
export function loadPStats() {
  return uni.getStorageSync('pstats') || { byModule: {}, days: {} };
}

export function checkinStreak(pstats) {
  const days = (pstats || loadPStats()).days || {};
  let n = 0;
  const d = new Date();
  if (!days[d.toISOString().slice(0, 10)]) d.setDate(d.getDate() - 1);
  while (days[d.toISOString().slice(0, 10)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
