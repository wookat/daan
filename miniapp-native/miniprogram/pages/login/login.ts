import { authLogin, authRegister, mergeAnon } from '../../api/index';
import { setAuth } from '../../utils/auth';

Page({
  data: {
    mode: 'login' as 'login' | 'register',
    phone: '',
    password: '',
    nickname: '',
    busy: false,
    err: '',
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
      if (anon && anon !== r.user.uid) {
        try {
          await mergeAnon(anon);
          wx.showToast({ title: '本机记录已合并到账号', icon: 'success', duration: 2000 });
        } catch (e) {
          /* 合并失败不阻断登录 */
        }
      }
      wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/profile/profile' }) });
    } catch (e) {
      this.setData({ err: (e as Error).message });
    } finally {
      this.setData({ busy: false });
    }
  },
});
