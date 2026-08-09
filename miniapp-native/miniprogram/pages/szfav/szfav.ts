import { fmtClock } from '../../utils/text';

interface SzFav {
  ts: number;
  question: string;
  options: Record<string, string>;
  answer: string;
  explanation: string;
  source_note: string;
}

interface Row extends SzFav {
  optList: Array<{ k: string; v: string }>;
  open: boolean;
  timeText: string;
}

function load(): SzFav[] {
  const v = wx.getStorageSync<SzFav[]>('szFavs');
  return Array.isArray(v) ? v : [];
}

Page({
  data: {
    items: [] as Row[],
  },
  onShow() {
    this.setData({
      items: load().map((f) => ({
        ...f,
        optList: Object.keys(f.options || {})
          .sort()
          .map((k) => ({ k, v: f.options[k] })),
        open: false,
        timeText: fmtClock(f.ts),
      })),
    });
  },
  onToggle(e: WechatMiniprogram.TouchEvent) {
    const i = Number(e.currentTarget.dataset.index);
    this.setData({ [`items[${i}].open`]: !this.data.items[i].open });
  },
  onRemove(e: WechatMiniprogram.TouchEvent) {
    const i = Number(e.currentTarget.dataset.index);
    const target = this.data.items[i];
    if (!target) return;
    const next = load().filter((f) => f.question !== target.question);
    wx.setStorageSync('szFavs', next);
    const items = [...this.data.items];
    items.splice(i, 1);
    this.setData({ items });
    wx.showToast({ title: '已取消收藏', icon: 'none' });
  },
  onGoDaily() {
    wx.navigateTo({ url: '/pages/practice/practice?mode=shizheng' });
  },
});
