// 打卡/刷题数统一口径：当天练过任意题（专项练习或模考均计入）即打卡。
// 在线时以服务端 /api/checkin/badges|summary（answer_log，Asia/Shanghai 日界）为准，
// 本地 pstats 仅作离线降级；日界按设备本地时区（国内用户即北京时间），与服务端口径一致。
export function dayKey(d = new Date()) {
  const p = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
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
