// 讨论区/广场/消息共用：相对时间、头像色调、发言登录门禁（文案与 H5 pkgA/social 一致）
import { getToken } from './auth';

const AV_TONES = ['warn', 'ok', 'brand', 'bad', 'info'];

export const REPORT_REASONS = ['广告导流', '人身攻击', '违法违规', '色情低俗', '其他'];

export function fmtRelTime(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 3600) return Math.max(1, Math.floor(diff / 60)) + ' 分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
  if (diff < 30 * 86400) return Math.floor(diff / 86400) + ' 天前';
  const d = new Date(ts * 1000);
  return `${d.getMonth() + 1}-${d.getDate()}`;
}

export function avatarTone(nm: string): string {
  let h = 0;
  for (let i = 0; i < nm.length; i++) h = (h * 31 + nm.charCodeAt(i)) >>> 0;
  return AV_TONES[h % AV_TONES.length];
}

export function isLogged(): boolean {
  return !!getToken();
}

// 未登录时弹 H5 同款确认框并跳登录页；返回是否已登录
export function ensureLogin(): boolean {
  if (isLogged()) return true;
  wx.showModal({
    title: '需要登录',
    content: '发言需登录账号，登录后即可参与讨论',
    confirmText: '去登录',
    success: (r) => {
      if (r.confirm) wx.navigateTo({ url: '/pages/login/login' });
    },
  });
  return false;
}
