import { lucideIcon } from '../utils/icons';
import { themeAccent, themeMode, tcClass, onThemeChange as onManualTheme } from '../utils/theme';

// 图标是 data-URI，拿不到 CSS 变量，按主题取 tokens.generated.wxss 里 --ink-3 / --brand 的字面值；
// on 色随 accent 皮肤切换
const ICON_OFF: Record<'light' | 'dark', string> = { light: '#6b7280', dark: '#8a8ea0' };
const ACCENT_ON: Record<string, string> = { default: '#2e5bff', forest: '#16a34a', sunset: '#ea580c' };

function effectiveTheme(): 'light' | 'dark' {
  const m = themeMode();
  if (m === 'dark') return 'dark';
  if (m === 'light') return 'light';
  return wx.getAppBaseInfo().theme === 'dark' ? 'dark' : 'light';
}

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

function buildTabs(): TabItem[] {
  const off = ICON_OFF[effectiveTheme()];
  const on = ACCENT_ON[themeAccent()] || ACCENT_ON.default;
  return TABS.map((t) => ({
    pagePath: t.pagePath,
    text: t.text,
    icon: lucideIcon(t.name, off),
    iconOn: lucideIcon(t.name, on),
  }));
}

const manualListeners = new WeakMap<object, () => void>();

Component({
  data: {
    active: 0,
    tabs: [] as TabItem[],
    tc: '',
  },
  lifetimes: {
    attached() {
      this.setData({ tabs: buildTabs(), tc: tcClass() });
      const onTheme: WechatMiniprogram.OnThemeChangeCallback = () =>
        this.setData({ tabs: buildTabs(), tc: tcClass() });
      themeListeners.set(this, onTheme);
      wx.onThemeChange(onTheme);
      // 手动三档/皮肤切换（不走 wx.onThemeChange）
      manualListeners.set(this, onManualTheme(() => this.setData({ tabs: buildTabs(), tc: tcClass() })));
    },
    detached() {
      const fn = themeListeners.get(this);
      if (fn) {
        wx.offThemeChange(fn);
        themeListeners.delete(this);
      }
      const off = manualListeners.get(this);
      if (off) {
        off();
        manualListeners.delete(this);
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
