import { authLogout } from '../../api/index';
import { anonUid, clearAuth, getAuthUser } from '../../utils/auth';
import { syncTabBar } from '../../utils/tabbar';

Page({
  data: {
    user: null as { uid: string; phone?: string; nickname?: string | null } | null,
    uid: '',
  },
  onShow() {
    syncTabBar(this, 4);
    this.setData({ user: getAuthUser(), uid: anonUid() });
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
