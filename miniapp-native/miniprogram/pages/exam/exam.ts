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
  onPaperTap(e: WechatMiniprogram.TouchEvent) {
    const title = String(e.currentTarget.dataset.title || '该卷');
    wx.showModal({
      title: '全真模考 · 二期上线预告',
      content: `「${title}」等整卷全真模考正在准备中，上线后可整卷计时作答。现在可以先用迷你模考（30 题混合模块）体验完整的交卷报告和薄弱考点分析。`,
      confirmText: '去迷你模考',
      cancelText: '知道了',
      success: (r) => {
        if (r.confirm) this.onMini();
      },
    });
  },
  onMini() {
    // 迷你模考：真实模考流程（attempt + 成绩报告 + 薄弱考点）
    wx.navigateTo({ url: '/pages/exam/mini' });
  },
});
