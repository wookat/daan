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
    // 一期：小模考走刷题闭环（混合模块 20 题）
    wx.navigateTo({ url: '/pages/practice/practice?count=20&source=mock' });
  },
});
