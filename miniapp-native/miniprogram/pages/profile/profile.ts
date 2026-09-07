import { authLogout, fetchCheckinBadges, fetchGrowth, fetchMistakes, fetchReminders } from '../../api/index';
import { fetchCommentInbox, pkMine } from '../../api/social';
import type { CheckinBadgesResp } from '../../api/types';
import { anonUid, clearAuth, getAuthUser, getToken } from '../../utils/auth';
import { subscribeAvailable } from '../../utils/config';
import { listPacks } from '../../utils/offline-pack';
import { loadPStats, streakDays } from '../../utils/stats';
import { syncTabBar } from '../../utils/tabbar';

Page({
  data: {
    user: null as { uid: string; phone?: string; nickname?: string | null } | null,
    avatarChar: '游',
    uid: '',
    badgeInfo: null as CheckinBadgesResp | null,
    nextMilestone: null as { days: number; left: number; pct: number } | null,
    reminderOn: false,
    remindAvail: false,
    inboxUnread: 0,
    pkN: 0,
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
    this.setData({
      user,
      avatarChar,
      uid: anonUid(),
      totalDone,
      streakN: streakDays(),
      offlineN: listPacks().length,
      remindAvail: subscribeAvailable(),
    });
    this.loadBadges();
    this.loadGrowth();
    this.loadReminder();
    this.loadMistakes();
    this.loadSocial();
  },
  // 我的页 Social 角标：讨论未读数（需登录）/ PK 战绩数（对齐 H5 profile 入口）
  async loadSocial() {
    try {
      const m = await pkMine();
      this.setData({ pkN: (m.items || []).length });
    } catch (e) {
      /* 非关键路径 */
    }
    if (!getToken()) {
      this.setData({ inboxUnread: 0 });
      return;
    }
    try {
      const d = await fetchCommentInbox();
      this.setData({ inboxUnread: d.unread || 0 });
    } catch (e) {
      /* 非关键路径 */
    }
  },
  onAsk() {
    wx.navigateTo({ url: '/pkgSocial/ask/ask' });
  },
  onInbox() {
    if (!getToken()) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pkgSocial/inbox/inbox' });
  },
  onFavorites() {
    wx.navigateTo({ url: '/pkgSocial/favorites/favorites' });
  },
  onInterviewHistory() {
    wx.navigateTo({ url: '/pkgSocial/history/history' });
  },
  onPk() {
    wx.navigateTo({ url: '/pkgSocial/pk/pk' });
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
  onReminder() {
    wx.navigateTo({ url: '/pkgSocial/reminders/reminders' });
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
  onExamList() {
    wx.navigateTo({ url: '/pkgExam/list/list' });
  },
  onShenlun() {
    wx.navigateTo({ url: '/pkgExam/shenlun/shenlun' });
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
