import { lucideIcon } from '../utils/icons';

const GRAY = '#7D818F';
const BRAND = '#3B6FF5';

interface TabItem {
  pagePath: string;
  text: string;
  icon: string;
  iconOn: string;
}

const TABS: Array<{ pagePath: string; text: string; name: string }> = [
  { pagePath: '/pages/home/home', text: '首页', name: 'home' },
  { pagePath: '/pages/book/book', text: '错题本', name: 'book' },
  { pagePath: '/pages/exam/exam', text: '模考', name: 'timer' },
  { pagePath: '/pages/stats/stats', text: '统计', name: 'chart' },
  { pagePath: '/pages/profile/profile', text: '我的', name: 'user' },
];

Component({
  data: {
    active: 0,
    tabs: [] as TabItem[],
  },
  lifetimes: {
    attached() {
      this.setData({
        tabs: TABS.map((t) => ({
          pagePath: t.pagePath,
          text: t.text,
          icon: lucideIcon(t.name, GRAY),
          iconOn: lucideIcon(t.name, BRAND),
        })),
      });
    },
  },
  methods: {
    onTap(e: WechatMiniprogram.TouchEvent) {
      const idx = Number(e.currentTarget.dataset.index);
      const tab = TABS[idx];
      if (!tab) return;
      wx.switchTab({ url: tab.pagePath });
      this.setData({ active: idx });
    },
  },
});
