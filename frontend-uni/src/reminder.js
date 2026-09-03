// 学习提醒：H5 用 Notification API 本地定时提示今日目标进度；
// 小程序端为订阅消息占位（无正式模板 ID 时降级隐藏订阅入口）。

import { dayKey } from './checkin.js';

// 微信订阅消息模板 ID（申请通过后填入即可启用订阅入口）
export const MP_SUBSCRIBE_TEMPLATE_ID = '';

const DEFAULT_TIME = '20:30';

export function getReminderSettings() {
  return {
    on: !!uni.getStorageSync('remindOn'),
    time: uni.getStorageSync('remindTime') || DEFAULT_TIME,
  };
}

export function setReminderSettings({ on, time }) {
  uni.setStorageSync('remindOn', on ? '1' : '');
  if (time) uni.setStorageSync('remindTime', time);
}

// #ifdef H5

export function notificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission; // granted / denied / default
}

export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch (e) {
    return 'denied';
  }
}

function todayProgress() {
  const pstats = uni.getStorageSync('pstats') || { days: {} };
  const goal = uni.getStorageSync('dailyGoal') || 20;
  const done = (pstats.days || {})[dayKey()] || 0;
  return { done, goal };
}

function fireReminder() {
  const { done, goal } = todayProgress();
  const left = Math.max(0, goal - done);
  const title = left
    ? `今晚还差 ${left} 题完成今日目标 🔥`
    : '今日目标已达成，来一局答题 PK？⚔️';
  const body = left
    ? `今日目标 ${goal} 题已完成 ${done} 题，练完守住连续打卡～`
    : `今天已练 ${done} 题，超棒！挑战一下考友巩固手感吧。`;
  try {
    const n = new Notification(title, { body, tag: 'kaogong-daily' });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch (e) { /* 通知被浏览器拦截时静默 */ }
}

let loopId = null;

// 页面存活期间每 30 秒检查一次：到点且今天没提醒过 → 提醒
export function initReminderLoop() {
  if (loopId) return;
  loopId = setInterval(() => {
    const { on, time } = getReminderSettings();
    if (!on || notificationPermission() !== 'granted') return;
    const now = new Date();
    const cur = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (cur < time) return;
    const today = dayKey(now);
    if (uni.getStorageSync('remindFired') === today) return;
    uni.setStorageSync('remindFired', today);
    fireReminder();
  }, 30 * 1000);
}

// #endif

// #ifdef MP-WEIXIN

// 订阅消息：一次授权一条；无正式模板 ID 时入口隐藏，此处仅占位
export function requestMpSubscribe() {
  return new Promise((resolve) => {
    if (!MP_SUBSCRIBE_TEMPLATE_ID) return resolve({ ok: false, reason: 'no_template' });
    wx.requestSubscribeMessage({
      tmplIds: [MP_SUBSCRIBE_TEMPLATE_ID],
      success: (res) => resolve({ ok: res[MP_SUBSCRIBE_TEMPLATE_ID] === 'accept' }),
      fail: () => resolve({ ok: false, reason: 'fail' }),
    });
  });
}

// #endif
