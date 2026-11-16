// 打卡/刷题数统一口径：当天练过任意题（专项练习或模考均计入）即打卡。
// 在线时以服务端 /api/checkin/badges|summary（answer_log，Asia/Shanghai 日界）为准，
// 本地 pstats 仅作离线降级；日界按设备本地时区（国内用户即北京时间），与服务端口径一致。
export function dayKey(d = new Date()) {
  const p = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// 与服务端 growth_stats 的 strftime('%Y-%W') 同口径：周一为一周首日，年内首个周一之前的日子计为第 00 周
// 传入的 d 应已是东八区日期（如 stats 页 cnToday）
export function cnWeekKey(d) {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const yday = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - jan1) / 86400000);
  const wdayMon = (d.getDay() + 6) % 7;
  const w = Math.floor((yday + 7 - wdayMon) / 7);
  return d.getFullYear() + '-' + (w < 10 ? '0' + w : '' + w);
}

// 时政每日一练完成态按 uid 隔离，避免同设备切换身份后互相污染；旧全局键迁移一次
export function loadSzDaily(uid) {
  const key = 'szDaily:' + uid;
  let d = uni.getStorageSync(key);
  if (!d) {
    d = uni.getStorageSync('szDaily');
    if (d) {
      uni.removeStorageSync('szDaily');
      uni.setStorageSync(key, d);
    }
  }
  return d || { days: {} };
}

export function saveSzDaily(uid, d) {
  uni.setStorageSync('szDaily:' + uid, d);
}

export function loadPStats() {
  return uni.getStorageSync('pstats') || { byModule: {}, days: {} };
}

export function checkinStreak(pstats) {
  const days = (pstats || loadPStats()).days || {};
  let n = 0;
  const d = new Date();
  if (!days[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (days[dayKey(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
