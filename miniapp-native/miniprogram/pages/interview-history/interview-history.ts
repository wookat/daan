import { interviewHistory } from '../../api/p3';
import type { InterviewHistoryItem } from '../../api/p3';
import { fmtAgo } from '../../utils/text';

interface Row extends InterviewHistoryItem {
  timeText: string;
}

Page({
  data: {
    loading: true,
    items: [] as Row[],
  },
  onLoad() {
    this.load();
  },
  async load() {
    try {
      const d = await interviewHistory();
      this.setData({
        loading: false,
        items: (d.items || []).map((x) => ({ ...x, timeText: fmtAgo(x.created_at) })),
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败：' + (e as Error).message, icon: 'none' });
    }
  },
  onOpen(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    if (id) wx.navigateTo({ url: '/pages/interview/interview?sid=' + id });
  },
});
