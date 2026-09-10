// 旧快照兜底时的横幅文案：区分「真离线」与「网络不稳定 / 服务响应慢」，并明示快照时刻，
// 不再把请求超时后的旧数据当「当前离线」或「已同步」陈述

/** 快照时刻 → 「刚刚 / n 分钟前 / n 小时前 / n 天前」 */
export function snapshotAgeText(snapAt, now = Date.now()) {
  const ms = Math.max(0, now - (Number(snapAt) || 0));
  if (!snapAt || ms < 60 * 1000) return '刚刚';
  const min = Math.floor(ms / 60000);
  if (min < 60) return min + ' 分钟前';
  const h = Math.floor(min / 60);
  if (h < 24) return h + ' 小时前';
  return Math.floor(h / 24) + ' 天前';
}

/**
 * @param {number} snapAt 快照时刻（ms），0 = 未知
 * @param {boolean|null} online navigator.onLine（端不支持传 null → 不断言离线）
 */
export function snapshotNotice(snapAt, online, now = Date.now()) {
  const head = online === false ? '当前离线' : '网络不稳定';
  const what = snapAt ? snapshotAgeText(snapAt, now) + '缓存的错题' : '已缓存的错题';
  const tail = online === false ? '联网后自动更新' : '可稍后重试';
  return head + ' · 展示' + what + '，' + tail;
}
