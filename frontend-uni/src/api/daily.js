// 每日一练成绩可靠投递：先落地 pending 再发送，失败保留幂等补投
import { request } from './client';

// ---------- 每日一练成绩可靠投递 ----------
// 完成页一次性 POST 在共享 origin 长尾（几十秒级）下可能超时/随关页被取消导致成绩丢失；
// 先落地 pending 再发送，失败保留，首页 onShow 幂等补投（服务端 (day,uid) 主键，重试安全）。
const DAILY_PENDING_KEY = 'dailyPendingSubmit';

export function submitDailySet(payload) {
  uni.setStorageSync(DAILY_PENDING_KEY, payload);
  return request('/api/daily_set/submit', { method: 'POST', data: payload }).then((d) => {
    uni.removeStorageSync(DAILY_PENDING_KEY);
    uni.setStorageSync('dailyDone:' + payload.uid, {
      date: payload.date, right: d.my_right, total: payload.total, rank: d.my_rank, streak: d.streak,
    });
    return d;
  });
}

// 返回 Promise<boolean>：本次是否真的补投成功（调用方据此刷新「已完成」外显）
export function flushDailySubmit() {
  const p = uni.getStorageSync(DAILY_PENDING_KEY);
  if (!p || !p.date || !p.uid) return Promise.resolve(false);
  const cnDay = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  if (p.date !== cnDay) {
    uni.removeStorageSync(DAILY_PENDING_KEY);
    return Promise.resolve(false);
  }
  return submitDailySet(p).then(() => true).catch(() => false);
}
