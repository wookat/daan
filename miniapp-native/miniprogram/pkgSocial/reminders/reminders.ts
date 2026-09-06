// 学习提醒（对齐 H5 pkgA/settings/reminders.vue）：本机 remindOn/remindTime + 微信订阅消息（模板 ID 见 utils/config，留空时入口隐藏）
import { fetchReminders, setReminder, trackEvent } from '../../api/index';
import { SUBSCRIBE_TMPL_ID, subscribeAvailable } from '../../utils/config';
import { dayKey, getDailyGoal, loadPStats } from '../../utils/stats';
import { toastInfo } from '../../utils/toast';

const DEFAULT_TIME = '20:30';

function hourOf(time: string): number {
  return Number(time.split(':')[0]) || 20;
}

Page({
  data: {
    on: false,
    time: DEFAULT_TIME,
    subAvail: false,
    subOn: false,
    done: 0,
    goal: 20,
    left: 20,
    reached: false,
  },

  onShow() {
    const on = !!wx.getStorageSync('remindOn');
    const time = (wx.getStorageSync('remindTime') as string) || DEFAULT_TIME;
    const goal = getDailyGoal();
    const done = (loadPStats().days || {})[dayKey()] || 0;
    this.setData({ on, time, goal, done, left: Math.max(0, goal - done), reached: done >= goal, subAvail: subscribeAvailable() });
    this.loadServer();
  },

  async loadServer() {
    try {
      const d = await fetchReminders();
      const r = (d.items || []).find((x) => x.channel === 'wxsub');
      this.setData({ subOn: !!(r && r.enabled) });
    } catch (e) {
      /* 非关键路径 */
    }
  },

  save(on: boolean, time: string) {
    wx.setStorageSync('remindOn', on ? '1' : '');
    if (time) wx.setStorageSync('remindTime', time);
  },

  onToggle(e: WechatMiniprogram.CustomEvent<{ value: boolean }>) {
    const on = !!e.detail.value;
    this.setData({ on });
    this.save(on, this.data.time);
    toastInfo(on ? `已开启 · 每天 ${this.data.time} 提醒` : '已关闭提醒');
    if (on && this.data.subAvail && !this.data.subOn) this.onSubscribe();
  },

  onTime(e: WechatMiniprogram.PickerChange) {
    const time = String(e.detail.value || DEFAULT_TIME);
    this.setData({ time });
    this.save(this.data.on, time);
    wx.removeStorageSync('remindFired');
    if (this.data.subOn && this.data.subAvail) setReminder('wxsub', true, hourOf(time)).catch(() => undefined);
    if (this.data.on) toastInfo(`每天 ${time} 提醒`);
  },

  onSubTap() {
    if (this.data.subOn) this.onUnsubscribe();
    else this.onSubscribe();
  },

  // 微信订阅消息：一次授权可收到一条服务通知；授权后在服务端登记 wxsub 渠道及提醒小时
  async onSubscribe() {
    if (!subscribeAvailable()) return;
    const ok = await new Promise<boolean>((resolve) => {
      wx.requestSubscribeMessage({
        tmplIds: [SUBSCRIBE_TMPL_ID],
        success: (r) => resolve(r[SUBSCRIBE_TMPL_ID] === 'accept'),
        fail: () => resolve(false),
      });
    });
    if (!ok) {
      toastInfo('未完成订阅');
      return;
    }
    try {
      await setReminder('wxsub', true, hourOf(this.data.time));
      this.setData({ subOn: true });
      trackEvent('reminder_optin', 'reminders');
      toastInfo('订阅成功');
    } catch (err) {
      toastInfo('操作失败：' + (err as Error).message);
    }
  },

  async onUnsubscribe() {
    try {
      await setReminder('wxsub', false);
      this.setData({ subOn: false });
      toastInfo('已关闭微信订阅提醒');
    } catch (err) {
      toastInfo('操作失败：' + (err as Error).message);
    }
  },
});
