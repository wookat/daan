// 外观模式三档：跟随系统 / 浅色 / 深色（存 themeMode）。
// 原生小程序 darkmode: true 时由系统主题驱动 @media(prefers-color-scheme)，
// 与 frontend-uni 小程序端一致：浅色/深色两档为设置占位，实际渲染跟随系统。

export const THEME_MODES = ['system', 'light', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const THEME_LABELS: Record<ThemeMode, string> = {
  system: '跟随系统',
  light: '浅色',
  dark: '深色',
};

export function getThemeMode(): ThemeMode {
  const m = wx.getStorageSync<string>('themeMode');
  return (THEME_MODES as readonly string[]).includes(m) ? (m as ThemeMode) : 'system';
}

export function cycleThemeMode(): ThemeMode {
  const next = THEME_MODES[(THEME_MODES.indexOf(getThemeMode()) + 1) % THEME_MODES.length];
  wx.setStorageSync('themeMode', next);
  return next;
}
