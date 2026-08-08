import { fetchContestReport } from '../../api/index';
import type { ContestReport } from '../../api/types';
import { modName } from '../../utils/stats';

interface ModRow {
  module: string;
  name: string;
  pct: number;
  correct: number;
  n: number;
  avgCorrect: number | null;
  minsText: string;
  recText: string;
}

Page({
  data: {
    loading: true,
    err: '',
    r: null as ContestReport | null,
    dist: [] as Array<{ h: number; me: boolean; label: number }>,
    mods: [] as ModRow[],
    history: [] as Array<{ id: number; score: number; h: number; cur: boolean }>,
    gapText: '',
    gapOk: false,
    top25Text: '',
    top25Ok: false,
  },
  _eventId: 0,

  onLoad(query: Record<string, string>) {
    this._eventId = Number(query.event_id);
    this.load();
  },

  async load() {
    try {
      const r = await fetchContestReport(this._eventId);
      const max = Math.max(1, ...(r.distribution || []));
      const gap = r.gap_to_target ?? 0;
      const top25Gap = r.top25_score != null ? Math.round((r.top25_score - r.score) * 10) / 10 : 0;
      this.setData({
        r,
        dist: (r.distribution || []).map((n, i) => ({
          h: n ? 15 + Math.round((n / max) * 85) : 4,
          me: i === r.my_bucket,
          label: i * 10,
        })),
        mods: (r.modules || []).map((m) => ({
          module: m.module,
          name: modName(m.module),
          pct: m.n ? Math.round((m.correct / m.n) * 100) : 0,
          correct: m.correct,
          n: m.n,
          avgCorrect: m.avg_correct ?? null,
          minsText: Math.round((m.secs || 0) / 60) + ' 分',
          recText: Math.round((m.rec_secs || 0) / 60) + ' 分',
        })),
        history: (r.history || []).map((a) => ({
          id: a.id,
          score: a.score,
          h: Math.max(8, a.score),
          cur: a.id === r.event.id,
        })),
        gapText: r.target_score != null ? (gap <= 0 ? '已达标 🎉' : '还差 ' + gap + ' 分') : '',
        gapOk: gap <= 0,
        top25Text:
          r.top25_score != null
            ? r.score >= r.top25_score
              ? '已进入前 25%'
              : '还差 ' + top25Gap + ' 分'
            : '',
        top25Ok: r.top25_score != null && r.score >= r.top25_score,
      });
    } catch (e) {
      this.setData({ err: (e as Error).message });
    }
    this.setData({ loading: false });
  },

  goPractice(tag3: string | null, count: number | null) {
    let url = '/pages/practice/practice?source=contest';
    if (tag3) url += '&tag3=' + encodeURIComponent(tag3);
    if (count) url += '&count=' + count;
    wx.navigateTo({ url });
  },
  onWeakTag(e: WechatMiniprogram.TouchEvent) {
    this.goPractice(String(e.currentTarget.dataset.tag3 || '') || null, 10);
  },
  onWeakPractice() {
    const r = this.data.r;
    const t = r && r.weak_tags && r.weak_tags[0];
    this.goPractice(t ? t.tag3 : null, 5);
  },
  onOpenAttempt() {
    const r = this.data.r;
    if (!r) return;
    wx.navigateTo({ url: '/pages/exam-report/exam-report?attempt_id=' + r.attempt_id });
  },
});
