import { authLogout, fetchCheckinBadges } from '../../api/index';
import type { CheckinBadgesResp } from '../../api/types';
import { anonUid, clearAuth, getAuthUser } from '../../utils/auth';
import { syncTabBar } from '../../utils/tabbar';

Page({
  data: {
    user: null as { uid: string; phone?: string; nickname?: string | null } | null,
    uid: '',
    badgeInfo: null as CheckinBadgesResp | null,
  },
  onShow() {
    syncTabBar(this, 4);
    this.setData({ user: getAuthUser(), uid: anonUid() });
    this.loadBadges();
  },
  // 徽章墙：连击口径以服务端 /api/checkin/badges 为准
  async loadBadges() {
    try {
      const badgeInfo = await fetchCheckinBadges();
      this.setData({ badgeInfo });
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
