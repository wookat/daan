import { fetchPapers } from '../../api/index';
import type { Paper } from '../../api/types';
import { syncTabBar } from '../../utils/tabbar';

Page({
  data: {
    loading: true,
    papers: [] as Paper[],
  },
  onShow() {
    syncTabBar(this, 2);
    this.load();
  },
  async load() {
    try {
      const d = await fetchPapers();
      this.setData({ papers: d.items || [] });
    } catch (e) {
      /* 静默失败，展示空态 */
    } finally {
      this.setData({ loading: false });
    }
  },
  onMini() {
    // 迷你模考：真实模考流程（attempt + 成绩报告 + 薄弱考点）
    wx.navigateTo({ url: '/pages/exam/mini' });
  },
});
