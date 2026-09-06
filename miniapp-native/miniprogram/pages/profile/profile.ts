import {
  authLogout,
  fetchCheckinBadges,
  fetchGrowth,
  fetchMistakes,
  fetchReminders,
  setReminder,
  trackEvent,
} from '../../api/index';
import type { CheckinBadgesResp } from '../../api/types';
import { anonUid, clearAuth, getAuthUser } from '../../utils/auth';
import { listPacks } from '../../utils/offline-pack';
import { loadPStats, streakDays } from '../../utils/stats';
import { syncTabBar } from '../../utils/tabbar';

// 订阅消息模板 ID：AppID/模板审核通过后填入即开闸，留空时仅登记提醒意向
const SUBSCRIBE_TMPL_ID = '';

Page({
  data: {
    user: null as { uid: string; phone?: string; nickname?: string | null } | null,
    avatarChar: '游',
    uid: '',
    badgeInfo: null as CheckinBadgesResp | null,
    nextMilestone: null as { days: number; left: number; pct: number } | null,
    reminderOn: false,
    totalDone: 0,
    streakN: 0,
    mistakeN: 0,
    badgeN: 0,
    offlineN: 0,
  },
  onShow() {
    syncTabBar(this, 4);
    const user = getAuthUser();
    const avatarChar = user ? (user.nickname || user.phone || '用').slice(0, 1) : '游';
    const s = loadPStats();
    let totalDone = 0;
    for (const k of Object.keys(s.byModule)) totalDone += s.byModule[k].done;
    this.setData({ user, avatarChar, uid: anonUid(), totalDone, streakN: streakDays(), offlineN: listPacks().length });
    this.loadBadges();
    this.loadGrowth();
    this.loadReminder();
    this.loadMistakes();
  },
  // 累计刷题：服务端 answer_log 口径（与统计页/H5 同源），失败保留本机 pstats
  async loadGrowth() {
    try {
      const g = await fetchGrowth();
      if (g.total && g.total.n != null) this.setData({ totalDone: g.total.n });
    } catch (e) {
      /* 离线：沿用本机 pstats */
    }
  },
  async loadMistakes() {
    try {
      const d = await fetchMistakes();
      this.setData({ mistakeN: (d.items || []).length });
    } catch (e) {
      /* 非关键路径 */
    }
  },
  async loadReminder() {
    try {
      const d = await fetchReminders();
      const r = (d.items || []).find((x) => x.channel === 'wxsub');
      this.setData({ reminderOn: !!(r && r.enabled) });
    } catch (e) {
      /* 非关键路径 */
    }
  },
  async onReminder() {
    if (this.data.reminderOn) {
      try {
        await setReminder('wxsub', false);
        this.setData({ reminderOn: false });
        wx.showToast({ title: '已关闭学习提醒', icon: 'none' });
      } catch (err) {
        wx.showToast({ title: '操作失败：' + (err as Error).message, icon: 'none' });
      }
      return;
    }
    // 模板已配置时先请求微信订阅授权；未配置/拒绝时降级为仅登记意向
    if (SUBSCRIBE_TMPL_ID && wx.requestSubscribeMessage) {
      try {
        await new Promise<void>((resolve, reject) => {
          wx.requestSubscribeMessage({
            tmplIds: [SUBSCRIBE_TMPL_ID],
            success: (r) => {
              if (r[SUBSCRIBE_TMPL_ID] === 'accept') resolve();
              else reject(new Error('未授权'));
            },
            fail: () => reject(new Error('订阅失败')),
          });
        });
      } catch (e) {
        wx.showToast({ title: '未开启订阅，已为你登记提醒意向', icon: 'none' });
      }
    }
    try {
      await setReminder('wxsub', true, 20);
      this.setData({ reminderOn: true });
      trackEvent('reminder_optin', 'profile');
      wx.showToast({
        title: SUBSCRIBE_TMPL_ID ? '已开启每日学习提醒' : '已登记提醒意向，订阅消息上线后自动生效',
        icon: 'none',
      });
    } catch (err) {
      wx.showToast({ title: '操作失败：' + (err as Error).message, icon: 'none' });
    }
  },
  // 徽章墙：连击口径以服务端 /api/checkin/badges 为准
  async loadBadges() {
    try {
      const badgeInfo = await fetchCheckinBadges();
      const ms = (badgeInfo.badges || []).map((b) => b.days);
      const s = badgeInfo.streak || 0;
      const next = ms.find((m) => m > s);
      let nextMilestone: { days: number; left: number; pct: number } | null = null;
      if (next) {
        let prev = 0;
        for (const m of ms) {
          if (m <= s) prev = m;
        }
        nextMilestone = {
          days: next,
          left: next - s,
          pct: Math.round(((s - prev) / (next - prev)) * 100),
        };
      }
      this.setData({
        badgeInfo,
        nextMilestone,
        badgeN: (badgeInfo.badges || []).filter((b) => b.unlocked).length,
        streakN: s || this.data.streakN,
      });
    } catch (e) {
      /* 非关键路径 */
    }
  },
  onTapBadge(e: WechatMiniprogram.TouchEvent) {
    const days = Number(e.currentTarget.dataset.days) || 0;
    const unlocked = !!e.currentTarget.dataset.unlocked;
    if (unlocked) {
      wx.navigateTo({ url: '/pages/social/poster?badge=' + days });
    } else {
      wx.showToast({ title: `连续打卡 ${days} 天即可解锁`, icon: 'none' });
    }
  },
  onTeam() {
    wx.navigateTo({ url: '/pages/team/team' });
  },
  onPracticeHistory() {
    wx.navigateTo({ url: '/pkgLearn/practice-history/practice-history' });
  },
  onOffline() {
    wx.navigateTo({ url: '/pkgLearn/offline/offline' });
  },
  onCalendar() {
    wx.navigateTo({ url: '/pkgGrow/calendar/calendar' });
  },
  onWeekly() {
    wx.navigateTo({ url: '/pkgGrow/weekly-report/weekly-report' });
  },
  onLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },
  async onLogout() {
    const res = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '退出登录',
        content: '退出后回到本机匿名记录，账号数据仍保留在云端',
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false),
      });
    });
    if (!res) return;
    await authLogout();
    clearAuth();
    this.setData({ user: null, uid: anonUid() });
    wx.showToast({ title: '已退出登录', icon: 'none' });
  },
});
