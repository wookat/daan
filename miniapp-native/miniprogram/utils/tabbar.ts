// Tab 页 onShow 时同步自定义 TabBar 选中项

interface TabBarComp {
  setData: (d: { active: number }) => void;
}

export function syncTabBar(page: WechatMiniprogram.Page.TrivialInstance, index: number): void {
  const getTabBar = (page as { getTabBar?: () => TabBarComp }).getTabBar;
  if (typeof getTabBar === 'function') {
    const bar = getTabBar.call(page);
    if (bar) bar.setData({ active: index });
  }
}
