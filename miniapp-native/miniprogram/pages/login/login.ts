import { authLogin, authRegister, authWxLogin, mergeAnon, trackEvent } from '../../api/index';
import { setAuth } from '../../utils/auth';

Page({
  data: {
    mode: 'login' as 'login' | 'register',
    phone: '',
    password: '',
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
        try {
          await mergeAnon(anon);
          wx.showToast({ title: '本机记录已合并到账号', icon: 'success', duration: 2000 });
        } catch (e) {
          /* 合并失败不阻断登录 */
        }
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
  onPhone(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ phone: e.detail.value });
  },
  onPassword(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ password: e.detail.value });
  },
  onNickname(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ nickname: e.detail.value });
  },
  async onSubmit() {
    const { mode, phone, password, nickname, busy } = this.data;
    if (busy) return;
    if (!/^1\d{10}$/.test(phone)) {
      this.setData({ err: '请输入 11 位手机号' });
      return;
    }
    if (password.length < 6) {
      this.setData({ err: '密码至少 6 位' });
      return;
    }
    this.setData({ busy: true, err: '' });
    try {
      const anon = wx.getStorageSync<string>('anonUid') || '';
      const r =
        mode === 'login'
          ? await authLogin(phone, password)
          : await authRegister(phone, password, nickname.trim());
      setAuth(r.token, r.user);
      if (mode === 'register') {
        const src = wx.getStorageSync<string>('regSource');
        if (src) {
          trackEvent('register', src);
          wx.removeStorageSync('regSource');
        }
      }
      if (anon && anon !== r.user.uid) {
        try {
          await mergeAnon(anon);
          wx.showToast({ title: '本机记录已合并到账号', icon: 'success', duration: 2000 });
        } catch (e) {
          /* 合并失败不阻断登录 */
        }
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
