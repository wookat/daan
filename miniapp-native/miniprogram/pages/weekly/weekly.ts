import { fetchWeeklyReport, markWeeklyRead } from '../../api/index';
import type { WeeklyReport } from '../../api/types';

function fmtMins(secs: number): string {
  return Math.round((secs || 0) / 60) + ' 分钟';
}

Page({
  data: {
    loading: true,
    err: '',
    state: '' as '' | 'empty' | 'pending' | 'ready',
    r: null as WeeklyReport | null,
    minsText: '',
    hasPrev: false,
  },
  _week: '',

  onLoad(query: Record<string, string>) {
    this._week = query.week || '';
    this.load();
  },

  async load() {
    this.setData({ loading: true, err: '' });
    try {
      const r = await fetchWeeklyReport(this._week || undefined);
      if (r.status === 'empty' || r.status === 'pending') {
        this.setData({ loading: false, state: r.status, r });
        return;
      }
      this.setData({
        loading: false,
        state: 'ready',
        r,
        minsText: r.summary ? fmtMins(r.summary.secs) : '',
        hasPrev: !!r.prev_week,
      });
      if (r.week_start) markWeeklyRead(r.week_start).catch(() => undefined);
    } catch (e) {
      this.setData({ loading: false, err: (e as Error).message });
    }
  },

  onPrevWeek() {
    const r = this.data.r;
    if (r && r.prev_week) {
      this._week = r.prev_week;
      this.load();
    }
  },

  onMockReport() {
    const r = this.data.r;
    if (r && r.mock) {
      wx.navigateTo({ url: '/pages/exam-report/exam-report?attempt_id=' + r.mock.attempt_id });
    }
  },

  onAction(e: WechatMiniprogram.TouchEvent) {
    const type = String(e.currentTarget.dataset.type || '');
    if (type === 'review') {
      wx.switchTab({ url: '/pages/book/book' });
    } else if (type === 'mock') {
      wx.switchTab({ url: '/pages/exam/exam' });
    } else {
      wx.navigateTo({ url: '/pages/practice/practice?count=10&source=weekly' });
    }
  },

  onGoPractice() {
    wx.navigateTo({ url: '/pages/practice/practice?count=10&source=weekly' });
  },
});
