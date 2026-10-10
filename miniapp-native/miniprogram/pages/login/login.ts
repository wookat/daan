import { authLogin, authRegister, authWxLogin, mergeAnon, trackEvent } from '../../api/index';
import { setAuth } from '../../utils/auth';

// 与 H5 pkgA/user/login.vue MERGE_FAIL_TIP 同文案：失败不阻断登录，anonUid 保留，下次登录再合并
const MERGE_FAIL_TIP = '已登录，但本机记录合并失败；退出后重新登录会再次合并';

async function mergeAnonWithToast(anon: string): Promise<void> {
  try {
    await mergeAnon(anon);
    wx.showToast({ title: '本机记录已合并到账号', icon: 'success', duration: 2000 });
  } catch (e) {
    wx.showToast({ title: MERGE_FAIL_TIP, icon: 'none', duration: 2500 });
  }
}

Page({
  data: {
    mode: 'login' as 'login' | 'register',
    email: '',
    password: '',
    password2: '',
    nickname: '',
    busy: false,
    wxBusy: false,
    err: '',
  },
  async onWxLogin() {
    if (this.data.wxBusy) return;
    this.setData({ wxBusy: true, err: '' });
    try {
      const { code } = await wx.login();
      if (!code) throw new Error('微信登录失败，请重试');
      const anon = wx.getStorageSync<string>('anonUid') || '';
      const r = await authWxLogin(code);
      setAuth(r.token, r.user);
      if (anon && anon !== r.user.uid) {
        await mergeAnonWithToast(anon);
      } else {
        wx.showToast({ title: '登录成功', icon: 'success' });
      }
      setTimeout(() => wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/profile/profile' }) }), 1200);
    } catch (e) {
      this.setData({ err: (e as Error).message });
    } finally {
      this.setData({ wxBusy: false });
    }
  },
  onSwitch() {
    this.setData({ mode: this.data.mode === 'login' ? 'register' : 'login', err: '' });
  },
  onEmail(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ email: e.detail.value });
  },
  onPassword(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ password: e.detail.value });
  },
  onPassword2(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ password2: e.detail.value });
  },
  onNickname(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ nickname: e.detail.value });
  },
  async onSubmit() {
    const { mode, email, password, password2, nickname, busy } = this.data;
    if (busy) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      this.setData({ err: '请输入正确的邮箱地址' });
      return;
    }
    if (password.length < 6) {
      this.setData({ err: '密码至少 6 位' });
      return;
    }
    if (mode === 'register' && password2 !== password) {
      this.setData({ err: '两次输入的密码不一致' });
      return;
    }
    this.setData({ busy: true, err: '' });
    try {
      const anon = wx.getStorageSync<string>('anonUid') || '';
      const r =
        mode === 'login'
          ? await authLogin(email, password)
          : await authRegister(email, password, nickname.trim());
      setAuth(r.token, r.user);
      if (mode === 'register') {
        const src = wx.getStorageSync<string>('regSource');
        if (src) {
          trackEvent('register', src);
          wx.removeStorageSync('regSource');
        }
      }
      if (anon && anon !== r.user.uid) {
        await mergeAnonWithToast(anon);
      } else {
        wx.showToast({ title: mode === 'login' ? '登录成功' : '注册成功', icon: 'success' });
      }
      setTimeout(() => wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/profile/profile' }) }), 1200);
    } catch (e) {
      this.setData({ err: (e as Error).message });
    } finally {
      this.setData({ busy: false });
    }
  },
});
