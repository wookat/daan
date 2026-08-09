import { authLogout, fetchCheckinSummary, fetchPredict } from '../../api/index';
import type { CheckinSummary, PredictResp } from '../../api/types';
import { anonUid, clearAuth, getAuthUser } from '../../utils/auth';
import { syncTabBar } from '../../utils/tabbar';
import { cycleThemeMode, getThemeMode, THEME_LABELS } from '../../utils/theme';

interface ModuleBar {
  module: string;
  name: string;
  score: number;
  max: number;
  pct: number;
  trend: number;
}

Page({
  data: {
    user: null as { uid: string; phone?: string; nickname?: string | null } | null,
    uid: '',
    predict: null as PredictResp | null,
    predictCold: false,
    predictNeed: 0,
    deltaText: '',
    modules: [] as ModuleBar[],
    history: [] as Array<{ label: string; score: number; h: number }>,
    checkin: null as CheckinSummary | null,
    themeLabel: '跟随系统',
    reminderOn: false,
  },

  onShow() {
    syncTabBar(this, 4);
    this.setData({
      user: getAuthUser(),
      uid: anonUid(),
      themeLabel: THEME_LABELS[getThemeMode()],
      reminderOn: !!wx.getStorageSync('remindOn'),
    });
    this.load();
  },

  async load() {
    try {
      const p = await fetchPredict();
      if (p.status === 'cold') {
        this.setData({ predictCold: true, predictNeed: p.need || 30, predict: p });
      } else {
        const hist = p.history || [];
        const maxS = Math.max(1, ...hist.map((h) => h.score));
        this.setData({
          predict: p,
          predictCold: false,
          deltaText:
            p.delta_week == null
              ? ''
              : p.delta_week >= 0
                ? '较上周 +' + p.delta_week
                : '较上周 ' + p.delta_week,
          modules: (p.modules || []).map((m) => ({
            ...m,
            pct: m.max ? Math.round((m.score / m.max) * 100) : 0,
          })),
          history: hist.map((h) => ({
            label: h.label,
            score: h.score,
            h: Math.max(8, Math.round((h.score / maxS) * 100)),
          })),
        });
      }
    } catch {
      /* 预测分获取失败时静默 */
    }
    try {
      const c = await fetchCheckinSummary();
      this.setData({ checkin: c });
    } catch {
      /* 打卡数据获取失败时静默 */
    }
  },

  onPoster() {
    wx.navigateTo({ url: '/pages/poster/poster' });
  },
  onFavorites() {
    wx.navigateTo({ url: '/pages/favorites/favorites' });
  },
  onTheme() {
    const next = cycleThemeMode();
    this.setData({ themeLabel: THEME_LABELS[next] });
    wx.showToast({
      title:
        '外观模式：' +
        THEME_LABELS[next] +
        (next === 'system' ? '' : '（小程序端跟随系统生效）'),
      icon: 'none',
    });
  },
  onReminder() {
    wx.navigateTo({ url: '/pages/reminders/reminders' });
  },
  onInterviewHistory() {
    wx.navigateTo({ url: '/pages/interview-history/interview-history' });
  },
  onSzFavs() {
    wx.navigateTo({ url: '/pages/szfav/szfav' });
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
