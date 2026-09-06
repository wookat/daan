import { fetchExamReport } from '../../api/index';
import type { ExamReportItem, ExamReportResp } from '../../api/types';
import { modName } from '../../utils/stats';

interface ModRow {
  module: string;
  name: string;
  n: number;
  correct: number;
  pct: number;
}

interface RQuestion extends ExamReportItem {
  optList: Array<{ k: string; v: string }>;
}

Page({
  data: {
    loading: true,
    report: null as ExamReportResp | null,
    accuracy: 0,
    usedMin: 0,
    modRows: [] as ModRow[],
    detail: null as RQuestion | null,
    loadErr: '',
  },
  _aid: 0,

  onLoad(query: Record<string, string | undefined>) {
    const aid = Number(query.attempt_id || 0);
    if (!aid) {
      wx.showToast({ title: '缺少报告参数', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    this._aid = aid;
    this.load(aid);
  },
  onReload() {
    if (!this._aid) return;
    this.setData({ loading: true, loadErr: '' });
    this.load(this._aid);
  },

  async load(aid: number) {
    try {
      const d = await fetchExamReport(aid);
      const modRows: ModRow[] = Object.keys(d.attempt.per_module || {}).map((m) => {
        const v = d.attempt.per_module[m];
        return {
          module: m,
          name: modName(m),
          n: v.n,
          correct: v.correct,
          pct: v.n ? Math.round((v.correct / v.n) * 100) : 0,
        };
      });
      const used = d.attempt.submitted_at && d.attempt.started_at
        ? Math.max(0, Math.round((d.attempt.submitted_at - d.attempt.started_at) / 60))
        : 0;
      this.setData({
        loading: false,
        report: d,
        accuracy: d.answered ? Math.round((d.correct / d.answered) * 100) : 0,
        usedMin: used,
        modRows,
      });
    } catch (e) {
      wx.showToast({ title: '加载失败：' + (e as Error).message, icon: 'none' });
      this.setData({ loading: false, loadErr: (e as Error).message || '网络错误' });
    }
  },

  onWeakPractice(e: WechatMiniprogram.TouchEvent) {
    const tag3 = String(e.currentTarget.dataset.tag3 || '');
    if (!tag3) return;
    wx.navigateTo({
      url: '/pages/practice/practice?tag3=' + encodeURIComponent(tag3) + '&count=10&source=exam_weak',
    });
  },
  onOpenDetail(e: WechatMiniprogram.TouchEvent) {
    const i = Number(e.currentTarget.dataset.i);
    const it = this.data.report && this.data.report.items[i];
    if (!it) return;
    const detail: RQuestion = {
      ...it,
      optList: Object.keys(it.options || {})
        .sort()
        .map((k) => ({ k, v: (it.options || {})[k] })),
    };
    this.setData({ detail });
  },
  onCloseDetail() {
    this.setData({ detail: null });
  },
  onDetailVisible(e: WechatMiniprogram.CustomEvent<{ visible: boolean }>) {
    if (!e.detail.visible) this.onCloseDetail();
  },
  onRetry() {
    wx.redirectTo({ url: '/pages/exam/mini' });
  },
  onBackExam() {
    wx.navigateBack({
      fail: () => wx.switchTab({ url: '/pages/exam/exam' }),
    });
  },
});
