// 外观模式（深色模式）：三档设置 跟随系统 / 浅色 / 深色，存 localStorage。
// H5 / App(Capacitor) 生效；小程序端由 utils/theme.ts 独立实现同口径逻辑。

import { anonUid, request } from './api.js';

export const THEME_MODES = ['system', 'light', 'dark'];
export const THEME_LABELS = { system: '跟随系统', light: '浅色', dark: '深色' };

export function getThemeMode() {
  const m = uni.getStorageSync('themeMode');
  return THEME_MODES.includes(m) ? m : 'system';
}

export function setThemeMode(mode) {
  uni.setStorageSync('themeMode', mode);
  applyTheme();
  persistTheme();
}

export function cycleThemeMode() {
  const next = THEME_MODES[(THEME_MODES.indexOf(getThemeMode()) + 1) % THEME_MODES.length];
  setThemeMode(next);
  return next;
}

function systemDark() {
  // #ifdef H5
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  // #endif
  // #ifndef H5
  return false; // eslint-disable-line no-unreachable
  // #endif
}

export function isDark() {
  const m = getThemeMode();
  return m === 'dark' || (m === 'system' && systemDark());
}

export function applyTheme() {
  // #ifdef H5
  const dark = isDark();
  document.documentElement.classList.toggle('theme-dark', dark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  applyAccent();

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#15161c' : '#eef3ff');
  // #endif
}

// 皮肤槽（accent）：default 不带类走 tokens 原值，其余打 .acc-<key> 到 html。
// 与小程序 utils/theme.ts 同口径；服务端同步走 POST /api/profile（theme_mode/theme_accent）。
export const THEME_ACCENTS = [
  { key: 'default', label: '品牌蓝', color: '#2e5bff' },
  { key: 'forest', label: '森林绿', color: '#16a34a' },
  { key: 'sunset', label: '暖橙', color: '#ea580c' },
];

export function getThemeAccent() {
  const a = uni.getStorageSync('themeAccent');
  return THEME_ACCENTS.some((x) => x.key === a) ? a : 'default';
}

export function setThemeAccent(acc) {
  uni.setStorageSync('themeAccent', acc);
  applyTheme();
  persistTheme();
}

// 外观偏好写服务端（匿名 uid 级），失败静默——本地 storage 是主真相
function persistTheme() {
  try {
    request('/api/profile', {
      method: 'POST',
      data: { uid: anonUid(), theme_mode: getThemeMode(), theme_accent: getThemeAccent() },
    }).catch(() => {});
  } catch (e) { /* 非关键路径 */ }
}

function applyAccent() {
  // #ifdef H5
  const el = document.documentElement;
  for (const x of THEME_ACCENTS) el.classList.remove('acc-' + x.key);
  const a = getThemeAccent();
  if (a !== 'default') el.classList.add('acc-' + a);
  // #endif
}

export function watchSystemTheme() {
  // #ifdef H5
  if (!window.matchMedia) return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (getThemeMode() === 'system') applyTheme();
  };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
  // #endif
}
