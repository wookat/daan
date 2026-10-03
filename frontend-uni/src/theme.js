// 外观模式（深色模式）：三档设置 跟随系统 / 浅色 / 深色，存 localStorage。
// H5 / App(Capacitor) 生效；小程序端降级保持浅色（darkmode 需原生配置，见 pages.json 注释）。

export const THEME_MODES = ['system', 'light', 'dark'];
export const THEME_LABELS = { system: '跟随系统', light: '浅色', dark: '深色' };

export function getThemeMode() {
  const m = uni.getStorageSync('themeMode');
  return THEME_MODES.includes(m) ? m : 'system';
}

export function setThemeMode(mode) {
  uni.setStorageSync('themeMode', mode);
  applyTheme();
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

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#15161c' : '#eef3ff');
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
