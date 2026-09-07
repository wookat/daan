// AI 面试练习记录（对齐 H5 pkgA/interview/history.vue）
import { interviewHistory } from '../../api/social';
import type { InterviewHistoryItem } from '../../api/social';
import { toastInfo } from '../../utils/toast';

interface Row extends InterviewHistoryItem {
  good: boolean;
  meta: string;
}

function p(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtDur(s: number): string {
  const m = Math.floor(s / 60);
  return m + "'" + p(s % 60) + '"';
}

Page({
  data: {
    items: [] as Row[],
    total: 0,
    best: '—' as string | number,
    avg: '—' as string | number,
    loaded: false,
    loadErr: '',
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loadErr: '' });
    try {
      const d = await interviewHistory(100);
      const items = (d.items || []).map((it) => ({
        ...it,
        good: it.total >= 80,
        meta: fmtTime(it.created_at) + ' · 作答 ' + fmtDur(it.duration_sec || 0),
      }));
      const avg = items.length ? Math.round(items.reduce((s, i) => s + (i.total || 0), 0) / items.length) : '—';
      this.setData({ items, total: d.total || 0, best: d.best == null ? '—' : d.best, avg, loaded: true });
    } catch (e) {
      const msg = (e as Error).message || '网络异常';
      this.setData({ loadErr: msg, loaded: true });
      toastInfo(msg);
    }
  },

  onOpen(e: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: '/pkgSocial/interview/interview?session_id=' + e.currentTarget.dataset.id });
  },

  goPractice() {
    wx.navigateTo({ url: '/pkgSocial/interview/interview' });
  },
});
