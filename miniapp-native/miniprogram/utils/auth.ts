// 登录态 / 匿名 uid：storage key 与 frontend-uni/src/api.js 保持一致
// anonUid / deviceAnonUid / authToken / authUser / accessCode

export interface AuthUser {
  uid: string;
  phone?: string;
  nickname?: string | null;
}

export function ensureAnonUid(): string {
  let uid = wx.getStorageSync<string>('anonUid');
  if (!uid) {
    uid = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    wx.setStorageSync('anonUid', uid);
  }
  return uid;
}

export function anonUid(): string {
  return ensureAnonUid();
}

export function getToken(): string {
  return wx.getStorageSync<string>('authToken') || '';
}

export function getAuthUser(): AuthUser | null {
  try {
    const u = wx.getStorageSync<AuthUser>('authUser');
    return u && u.uid ? u : null;
  } catch (e) {
    return null;
  }
}

// 登录：保留本机匿名 uid 以便合并，并把当前 uid 切到账号稳定 uid
export function setAuth(token: string, user: AuthUser): void {
  const cur = wx.getStorageSync<string>('anonUid');
  if (cur && cur !== user.uid && !wx.getStorageSync('deviceAnonUid')) {
    wx.setStorageSync('deviceAnonUid', cur);
  }
  wx.setStorageSync('authToken', token);
  wx.setStorageSync('authUser', user);
  wx.setStorageSync('anonUid', user.uid);
}

// 退出/401：清登录态，回到本机匿名 uid
export function clearAuth(): void {
  wx.removeStorageSync('authToken');
  wx.removeStorageSync('authUser');
  const dev = wx.getStorageSync<string>('deviceAnonUid');
  if (dev) wx.setStorageSync('anonUid', dev);
  else wx.removeStorageSync('anonUid');
}

// 组队/分享昵称：登录昵称 > 考友+手机尾号 > 本地随机昵称（复刻 api.js pkNickname）
export function pkNickname(): string {
  const u = getAuthUser();
  if (u && u.nickname) return u.nickname;
  if (u && u.phone) return '考友' + String(u.phone).slice(-4);
  let n = wx.getStorageSync<string>('pkNickname');
  if (!n) {
    n = '考友' + Math.random().toString(36).slice(2, 6).toUpperCase();
    wx.setStorageSync('pkNickname', n);
  }
  return n;
}

export function getAccessCode(): string {
  return wx.getStorageSync<string>('accessCode') || '';
}

export function setAccessCode(code: string): void {
  wx.setStorageSync('accessCode', code.trim());
}

export function clearAccessCode(): void {
  wx.removeStorageSync('accessCode');
}
