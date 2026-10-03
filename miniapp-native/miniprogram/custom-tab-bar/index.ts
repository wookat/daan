import { lucideIcon } from '../utils/icons';

// 图标是 data-URI，拿不到 CSS 变量，按主题取 tokens.generated.wxss 里 --ink-3 / --brand 的字面值
const ICON_COLORS: Record<'light' | 'dark', { off: string; on: string }> = {
  light: { off: '#6b7280', on: '#2e5bff' },
  dark: { off: '#8a8ea0', on: '#2e5bff' },
};

interface TabItem {
  pagePath: string;
  text: string;
  icon: string;
  iconOn: string;
}

const TABS: Array<{ pagePath: string; text: string; name: string }> = [
  { pagePath: '/pages/home/home', text: '刷题', name: 'home' },
  { pagePath: '/pages/book/book', text: '错题本', name: 'book' },
  { pagePath: '/pages/exam/exam', text: '模考', name: 'timer' },
  { pagePath: '/pages/stats/stats', text: '统计', name: 'chart' },
  { pagePath: '/pages/profile/profile', text: '我的', name: 'user' },
];

const themeListeners = new WeakMap<object, WechatMiniprogram.OnThemeChangeCallback>();

function buildTabs(theme: 'light' | 'dark'): TabItem[] {
  const c = ICON_COLORS[theme];
  return TABS.map((t) => ({
    pagePath: t.pagePath,
    text: t.text,
    icon: lucideIcon(t.name, c.off),
    iconOn: lucideIcon(t.name, c.on),
  }));
}

Component({
  data: {
    active: 0,
    tabs: [] as TabItem[],
  },
  lifetimes: {
    attached() {
      const theme = wx.getAppBaseInfo().theme === 'dark' ? 'dark' : 'light';
      this.setData({ tabs: buildTabs(theme) });
      const onTheme: WechatMiniprogram.OnThemeChangeCallback = (res) =>
        this.setData({ tabs: buildTabs(res.theme === 'dark' ? 'dark' : 'light') });
      themeListeners.set(this, onTheme);
      wx.onThemeChange(onTheme);
    },
    detached() {
      const fn = themeListeners.get(this);
      if (fn) {
        wx.offThemeChange(fn);
        themeListeners.delete(this);
      }
    },
  },
  methods: {
    onTap(e: WechatMiniprogram.TouchEvent) {
      const idx = Number(e.currentTarget.dataset.index);
      const tab = TABS[idx];
      if (!tab || idx === this.data.active) return;
      wx.switchTab({
        url: tab.pagePath,
        success: () => this.setData({ active: idx }),
        fail: (err) => {
          console.error('switchTab fail', tab.pagePath, err);
          wx.reLaunch({ url: tab.pagePath });
        },
      });
    },
  },
});
