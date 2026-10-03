// 外观系统：模式三档（跟随系统/浅色/深色）+ 皮肤槽（accent）。
// 机制：app.json darkmode:true + 生成 wxss 的 prefers-color-scheme 块负责「跟随系统」；
// 手动档把 .tc-light/.tc-dark/.acc-* 类打到各页顶层容器（wxml {{tc}}）。
// 页面无需各自接数据——wx.onAppRoute 拿到 Page 实例直接 setData({tc})，
// 换肤时 getCurrentPages() 全栈刷新。navbar/tabbar 等组件同样吃宿主上的 class（class 透传到宿主节点）。

import { anonUid } from './auth';
import { request } from './request';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ThemeAccent = 'default' | 'forest' | 'sunset';

const MODE_KEY = 'kg_theme_mode';
const ACC_KEY = 'kg_theme_accent';
export const THEME_MODES: { key: ThemeMode; label: string }[] = [
  { key: 'system', label: '跟随系统' },
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '深色' },
];
export const THEME_ACCENTS: { key: ThemeAccent; label: string; color: string }[] = [
  { key: 'default', label: '品牌蓝', color: '#2e5bff' },
  { key: 'forest', label: '森林绿', color: '#16a34a' },
  { key: 'sunset', label: '暖橙', color: '#ea580c' },
];

export function themeMode(): ThemeMode {
  const m = wx.getStorageSync(MODE_KEY);
  return m === 'light' || m === 'dark' || m === 'system' ? m : 'system';
}

export function themeAccent(): ThemeAccent {
  const a = wx.getStorageSync(ACC_KEY);
  return THEME_ACCENTS.some((x) => x.key === a) ? a : 'default';
}

/** 顶层容器 class：system 留空走媒体查询；accent 非 default 附加 .acc-* */
export function tcClass(): string {
  const parts: string[] = [];
  const m = themeMode();
  if (m === 'light') parts.push('tc-light');
  else if (m === 'dark') parts.push('tc-dark');
  const a = themeAccent();
  if (a !== 'default') parts.push('acc-' + a);
  return parts.join(' ');
}

type PageLike = { setData?: (d: Record<string, unknown>) => void };

function applyToPage(p: PageLike | undefined): void {
  try {
    p?.setData?.({ tc: tcClass() });
  } catch {
    /* 页面销毁竞态静默 */
  }
}

function applyAll(): void {
  try {
    for (const p of getCurrentPages() as PageLike[]) applyToPage(p);
  } catch {
    /* noop */
  }
  notify();
}

// 组件（tabbar 等 page 外渲染）自己的 listener
const listeners = new Set<() => void>();
export function onThemeChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* noop */
    }
  }
}

export function setThemeMode(mode: ThemeMode): void {
  wx.setStorageSync(MODE_KEY, mode);
  applyAll();
  persistTheme();
}

export function setThemeAccent(acc: ThemeAccent): void {
  wx.setStorageSync(ACC_KEY, acc);
  applyAll();
  persistTheme();
}

// 云端同步：POST /api/profile（user_profile.theme_mode/theme_accent，匿名 uid 口径与现有 profile 一致）。
// 静默上报，失败不影响本地生效；登录/换机回拉在 profile 页 fetchProfile 处同步。
function persistTheme(): void {
  try {
    request('/api/profile', {
      method: 'POST',
      data: { uid: anonUid(), theme_mode: themeMode(), theme_accent: themeAccent() },
    }).catch(() => {});
  } catch {
    /* 接口未上线/网络失败静默 */
  }
}

/** App.onLaunch 调用：路由钩子给新页面实例打 tc（wx.onAppRoute 不回调 page 对象，
 * 路由触发时新页面已入栈顶）+ 系统深浅切换时刷新全栈 */
export function installTheme(): void {
  if (typeof wx.onAppRoute === 'function') {
    wx.onAppRoute(() => {
      applyAll();
      // 部分路由时机栈顶尚未换到新页，下一拍再补一次（对首帧闪切为幂等 setData）
      setTimeout(applyAll, 0);
    });
  }
  if (typeof wx.onThemeChange === 'function') {
    wx.onThemeChange(() => {
      if (themeMode() === 'system') applyAll();
    });
  }
}
