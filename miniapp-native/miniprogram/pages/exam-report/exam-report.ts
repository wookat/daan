import { fetchExamAttempts, fetchExamRank, fetchExamReport } from '../../api/index';
import type { ExamRankResp, ExamReport, ExamReportItem } from '../../api/types';
import { modName } from '../../utils/stats';

interface ModRow {
  key: string;
  name: string;
  n: number;
  correct: number;
  pct: number;
}

interface DistCol {
  h: number;
  me: boolean;
  label: number;
}

Page({
  data: {
    loading: true,
    err: '',
    score: 0,
    accPct: 0,
    answered: 0,
    total: 0,
    title: '',
    mods: [] as ModRow[],
    items: [] as Array<ExamReportItem & { optList: Array<{ k: string; v: string }> }>,
    rank: null as ExamRankResp | null,
    dist: [] as DistCol[],
    history: [] as Array<{ id: number; score: number; h: number }>,
    detail: null as (ExamReportItem & { optList: Array<{ k: string; v: string }> }) | null,
  },
  _attemptId: 0,

  onLoad(query: Record<string, string>) {
    this._attemptId = Number(query.attempt_id);
    this.load();
    this.loadRank();
    this.loadHistory();
  },

  async load() {
    try {
      const r: ExamReport = await fetchExamReport(this._attemptId);
      const perMod: Record<string, { n: number; correct: number }> = {};
      (r.items || []).forEach((it) => {
        const m = it.module || 'other';
        if (!perMod[m]) perMod[m] = { n: 0, correct: 0 };
        perMod[m].n++;
        if (it.correct) perMod[m].correct++;
      });
      const mods: ModRow[] = Object.keys(perMod).map((k) => ({
        key: k,
        name: modName(k),
        n: perMod[k].n,
        correct: perMod[k].correct,
        pct: Math.round((perMod[k].correct / perMod[k].n) * 100),
      }));
      this.setData({
        loading: false,
        score: r.attempt.score,
        total: r.total,
        answered: r.answered,
        accPct: r.total ? Math.round((r.correct / r.total) * 100) : 0,
        title: r.paper.title,
        mods,
        items: (r.items || []).map((it) => ({
          ...it,
          optList: Object.keys(it.options || {})
            .sort()
            .map((k) => ({ k, v: it.options[k] })),
        })),
      });
    } catch (e) {
      this.setData({ loading: false, err: (e as Error).message });
    }
  },

  async loadRank() {
    try {
      const rank = await fetchExamRank(this._attemptId);
      const distRaw = rank.distribution || [];
      const max = Math.max(1, ...distRaw);
      const dist: DistCol[] = distRaw.map((n, i) => ({
        h: n ? 15 + Math.round((n / max) * 85) : 4,
        me: i === rank.my_bucket,
        label: i * 10,
      }));
      this.setData({ rank, dist });
    } catch (e) {
      /* 排名非关键路径 */
    }
  },

  async loadHistory() {
    try {
      const d = await fetchExamAttempts(null, 10);
      const items = (d.items || []).slice(0, 8).reverse();
      const max = Math.max(1, ...items.map((a) => a.score));
      this.setData({
        history: items.map((a) => ({
          id: a.id,
          score: a.score,
          h: Math.max(8, Math.round((a.score / max) * 100)),
        })),
      });
    } catch (e) {
      /* 非关键路径 */
    }
  },

  onOpenItem(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.index);
    this.setData({ detail: this.data.items[idx] || null });
  },
  onCloseDetail() {
    this.setData({ detail: null });
  },
  noop() {
    /* 阻止冒泡 */
  },
  onBackList() {
    wx.switchTab({ url: '/pages/exam/exam' });
  },
});
