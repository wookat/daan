// H5 底部 TabBar 矢量内联图标（零网络请求、切换 0ms 响应，自动跟随深色模式与三套主题色皮肤）
// 路径直接复用 Lucide（与全站 l-icon 同源）：
// 1. 启动前直接覆写 window.__uniConfig.tabBar.list，确保首帧挂载即用 data:image/svg+xml（0 个 /static/tab/*.png 请求）；
// 2. 运行期切换深浅色/主题皮肤时通过 uni.setTabBarItem + uni.setTabBarStyle 实时刷新响应式 tabBar。

const TAB_SPECS = [
  {
    index: 0,
    paths: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
  },
  {
    index: 1,
    paths: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  },
  {
    index: 2,
    paths: '<path d="M12 6V2H8"/><path d="m8 18-4 4V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2Z"/><path d="M2 12h2"/><path d="M9 11v2"/><path d="M15 11v2"/><path d="M20 12h2"/>',
  },
  {
    index: 3,
    paths: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  },
  {
    index: 4,
    paths: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  },
];

const ACTIVE_COLORS = {
  light: { default: '#2e5bff', forest: '#16a34a', sunset: '#ea580c' },
  dark: { default: '#8fa8ff', forest: '#4ade80', sunset: '#fb923c' },
};

const INACTIVE_COLORS = {
  light: '#6b7280',
  dark: '#8a8ea0',
};

let _lastSpec = null;
let _pendingLiveSync = false;
let _bootPatched = false;

export function buildTabSvgUri(paths, stroke, active = false) {
  const sw = active ? '2.15' : '1.85';
  const fill = active ? stroke : 'none';
  const fillOp = active ? ' fill-opacity="0.12"' : '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ` +
    `fill="${fill}"${fillOp} stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export function syncH5TabBarIcons({ dark = false, accent = 'default' } = {}) {
  // #ifdef H5
  const mode = dark ? 'dark' : 'light';
  const inactive = INACTIVE_COLORS[mode];
  const active = (ACTIVE_COLORS[mode] && ACTIVE_COLORS[mode][accent]) || ACTIVE_COLORS[mode].default;
  const bg = dark ? '#1d1f28' : '#ffffff';
  _lastSpec = { dark, accent };

  // 1. 仅首帧抢在 uni-h5 useTabBar() 首次 reactive(__uniConfig.tabBar) 前就地替换一次，确保 0 PNG 请求；
  //    运行期切皮肤/深色绝不直接改 raw 对象（否则绕过 Vue 3 Proxy 导致后续 setTabBarItem 判 Object.is 相等而跳过重渲染）
  const cfg = !_bootPatched && typeof window !== 'undefined' && window.__uniConfig && window.__uniConfig.tabBar;
  if (cfg && Array.isArray(cfg.list)) {
    _bootPatched = true;
    cfg.color = inactive;
    cfg.selectedColor = active;
    cfg.backgroundColor = bg;
    for (const t of TAB_SPECS) {
      const item = cfg.list[t.index];
      if (!item) continue;
      item.iconPath = buildTabSvgUri(t.paths, inactive, false);
      item.selectedIconPath = buildTabSvgUri(t.paths, active, true);
    }
  }

  // 2. 运行期响应式同步（不要写 typeof uni === 'undefined'：vite-plugin-uni 把 uni.xxx 静态改写成 ESM 导入，生产构建全局并无 uni 对象）
  _pendingLiveSync = false;
  try {
    if (typeof uni.setTabBarItem === 'function') {
      for (const t of TAB_SPECS) {
        try {
          const ret = uni.setTabBarItem({
            index: t.index,
            iconPath: buildTabSvgUri(t.paths, inactive, false),
            selectedIconPath: buildTabSvgUri(t.paths, active, true),
            fail: () => { _pendingLiveSync = true; },
          });
          if (ret && typeof ret.catch === 'function') ret.catch(() => { _pendingLiveSync = true; });
        } catch (e) {
          _pendingLiveSync = true;
        }
      }
    }
    if (typeof uni.setTabBarStyle === 'function') {
      try {
        const ret = uni.setTabBarStyle({
          color: inactive,
          selectedColor: active,
          backgroundColor: bg,
          fail: () => { _pendingLiveSync = true; },
        });
        if (ret && typeof ret.catch === 'function') ret.catch(() => { _pendingLiveSync = true; });
      } catch (e) {
        _pendingLiveSync = true;
      }
    }
  } catch (e) { /* 非 uni 环境（单测等）静默忽略 */ }
  // #endif
}

export function flushH5TabBarIcons() {
  // #ifdef H5
  if (_pendingLiveSync && _lastSpec) syncH5TabBarIcons(_lastSpec);
  // #endif
}
