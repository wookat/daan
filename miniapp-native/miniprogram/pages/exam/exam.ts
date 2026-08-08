import {
  exportPdf,
  fetchExamAttempts,
  fetchExamPaperDetail,
  fetchExamPapers,
} from '../../api/index';
import type { ExamAttempt, ExamFilters, ExamPaper } from '../../api/types';
import { syncTabBar } from '../../utils/tabbar';

function fmtTime(t?: number): string {
  if (!t) return '';
  const d = new Date(t * 1000);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

Page({
  data: {
    loading: true,
    papers: [] as ExamPaper[],
    filters: { years: [], regions: [] } as ExamFilters,
    year: null as number | null,
    region: null as string | null,
    attempts: [] as Array<ExamAttempt & { timeText: string }>,
    exportTarget: null as ExamPaper | null,
    exporting: false,
  },
  onShow() {
    syncTabBar(this, 2);
    this.load();
    this.loadAttempts();
  },
  async load() {
    this.setData({ loading: true });
    try {
      const d = await fetchExamPapers(this.data.year, this.data.region);
      this.setData({
        papers: d.items || [],
        filters: d.filters || { years: [], regions: [] },
      });
    } catch (e) {
      wx.showToast({ title: '加载失败：' + (e as Error).message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
  async loadAttempts() {
    try {
      const d = await fetchExamAttempts(null, 10);
      this.setData({
        attempts: (d.items || []).map((a) => ({ ...a, timeText: fmtTime(a.submitted_at) })),
      });
    } catch (e) {
      /* 非关键路径 */
    }
  },
  onYear(e: WechatMiniprogram.TouchEvent) {
    const y = e.currentTarget.dataset.y;
    this.setData({ year: y == null || y === '' ? null : Number(y) });
    this.load();
  },
  onRegion(e: WechatMiniprogram.TouchEvent) {
    const r = e.currentTarget.dataset.r;
    this.setData({ region: r || null });
    this.load();
  },
  onMini() {
    wx.navigateTo({ url: '/pages/exam-run/exam-run?mini=1' });
  },
  onContest() {
    wx.navigateTo({ url: '/pages/contest/contest' });
  },
  onStartPaper(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    wx.navigateTo({ url: '/pages/exam-run/exam-run?paper_id=' + id });
  },
  onOpenReport(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    wx.navigateTo({ url: '/pages/exam-report/exam-report?attempt_id=' + id });
  },
  onAskExport(e: WechatMiniprogram.TouchEvent) {
    if (this.data.exporting) return;
    const idx = Number(e.currentTarget.dataset.index);
    this.setData({ exportTarget: this.data.papers[idx] || null });
  },
  onExportClose() {
    this.setData({ exportTarget: null });
  },
  async onExportConfirm(e: WechatMiniprogram.CustomEvent) {
    const p = this.data.exportTarget;
    if (!p || this.data.exporting) return;
    this.setData({ exporting: true });
    try {
      const d = await fetchExamPaperDetail(p.id);
      await exportPdf({
        title: p.title,
        question_ids: d.paper.question_ids || [],
        ...e.detail,
      });
      this.setData({ exportTarget: null });
      wx.showToast({ title: 'PDF 已生成', icon: 'none' });
    } catch (err) {
      wx.showToast({ title: '导出失败：' + (err as Error).message, icon: 'none' });
    } finally {
      this.setData({ exporting: false });
    }
  },
});
