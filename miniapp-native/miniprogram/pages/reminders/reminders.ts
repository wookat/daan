import { getReminderSettings, mpSubscribeAvailable, requestMpSubscribe, setReminderSettings } from '../../utils/reminder';
import { getDailyGoal, todayCount } from '../../utils/stats';

Page({
  data: {
    on: false,
    time: '20:30',
    subscribeAvailable: false,
    previewTitle: '',
    previewBody: '',
  },

  onLoad() {
    const s = getReminderSettings();
    this.setData({ on: s.on, time: s.time, subscribeAvailable: mpSubscribeAvailable() });
    this.updatePreview();
  },

  updatePreview() {
    const done = todayCount();
    const goal = getDailyGoal();
    const left = Math.max(0, goal - done);
    this.setData({
      previewTitle: left ? `今晚还差 ${left} 题完成今日目标 🔥` : '今日目标已达成，来一局答题 PK？⚔️',
      previewBody: left
        ? `今日目标 ${goal} 题已完成 ${done} 题，练完守住连续打卡～`
        : `今天已练 ${done} 题，超棒！挑战一下考友巩固手感吧。`,
    });
  },

  onToggle() {
    const on = !this.data.on;
    this.setData({ on });
    setReminderSettings({ on, time: this.data.time });
    wx.showToast({ title: on ? '已开启学习提醒' : '已关闭学习提醒', icon: 'none' });
  },
  onTimeChange(e: WechatMiniprogram.PickerChange) {
    const time = String(e.detail.value);
    this.setData({ time });
    setReminderSettings({ on: this.data.on, time });
  },

  async onSubscribe() {
    if (!this.data.subscribeAvailable) {
      wx.showToast({ title: '订阅消息模板待配置（需正式 AppID），当前为占位流程', icon: 'none', duration: 2500 });
      return;
    }
    const r = await requestMpSubscribe();
    wx.showToast({
      title: r.ok ? '已订阅，今晚到点微信提醒你' : '未订阅成功，可稍后再试',
      icon: 'none',
    });
  },
});
