import { fetchPapers } from '../../api/index';
import type { Paper } from '../../api/types';
import { syncTabBar } from '../../utils/tabbar';

type PaperVM = Paper & { yearShort: string; regionShort: string };

Page({
  data: {
    loading: true,
    papers: [] as PaperVM[],
  },
  onShow() {
    syncTabBar(this, 2);
    this.load();
  },
  async load() {
    try {
      const d = await fetchPapers();
      const papers: PaperVM[] = (d.items || []).map((p) => {
        const y = String(p.year || '');
        const region = String(p.region || '');
        let regionShort = '真题';
        if (region.indexOf('国考') > -1 || region.indexOf('国家') > -1) regionShort = '国考';
        else if (region.indexOf('联考') > -1) regionShort = '联考';
        else if (region) regionShort = region.slice(0, 2);
        return { ...p, yearShort: y.length === 4 ? y.slice(2) : y, regionShort };
      });
      this.setData({ papers });
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
