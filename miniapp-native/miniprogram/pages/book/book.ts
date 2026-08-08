import { fetchFavs, fetchMistakes, patchMistake } from '../../api/index';
import type { FavItem, Mistake } from '../../api/types';
import { modName } from '../../utils/stats';
import { syncTabBar } from '../../utils/tabbar';

interface MRow extends Mistake {
  modName: string;
  open: boolean;
}

Page({
  data: {
    tab: 'todo' as 'todo' | 'done' | 'fav',
    loading: true,
    all: [] as MRow[],
    shown: [] as MRow[],
    favs: [] as FavItem[],
    todoCount: 0,
    doneCount: 0,
  },
  onShow() {
    syncTabBar(this, 1);
    this.load();
  },
  async load() {
    this.setData({ loading: true });
    try {
      const [m, f] = await Promise.all([
        fetchMistakes(),
        fetchFavs().catch(() => ({ items: [] as FavItem[] })),
      ]);
      const all = (m.items || []).map((x) => ({ ...x, modName: modName(x.module), open: false }));
      this.setData({
        all,
        favs: f.items || [],
        todoCount: all.filter((x) => !x.mastered).length,
        doneCount: all.filter((x) => !!x.mastered).length,
      });
      this.applyTab();
    } catch (e) {
      wx.showToast({ title: '加载失败：' + (e as Error).message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
  applyTab() {
    const { tab, all } = this.data;
    const shown =
      tab === 'todo' ? all.filter((x) => !x.mastered) : tab === 'done' ? all.filter((x) => !!x.mastered) : [];
    this.setData({ shown });
  },
  onTab(e: WechatMiniprogram.TouchEvent) {
    this.setData({ tab: e.currentTarget.dataset.tab as 'todo' | 'done' | 'fav' });
    this.applyTab();
  },
  onToggle(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.index);
    this.setData({ [`shown[${idx}].open`]: !this.data.shown[idx].open });
  },
  async onMaster(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.index);
    const m = this.data.shown[idx];
    if (!m) return;
    const on = !m.mastered;
    try {
      await patchMistake(m.id, { mastered: on ? 1 : 0 });
      wx.showToast({ title: on ? '已标记掌握' : '已移回待掌握', icon: 'none' });
      this.load();
    } catch (err) {
      wx.showToast({ title: '操作失败：' + (err as Error).message, icon: 'none' });
    }
  },
  onRedo() {
    wx.navigateTo({ url: '/pages/practice/practice?mode=redo&source=redo' });
  },
});
