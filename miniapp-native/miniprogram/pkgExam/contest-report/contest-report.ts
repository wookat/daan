// 赛后报告：对照 H5 pkgA/exam/contest-report.vue（hero/小样本提示/统计/目标差/模块表现/薄弱考点/历届成绩/分数分布）
import { fetchMockReport } from '../../api/exam';
import type { MockReportResp } from '../../api/exam-types';
import { modName } from '../../utils/stats';
import { submitRetryable } from '../../utils/kg-exam-progress';

interface ModVM {
  module: string;
  name: string;
  pct: number;
  line1: string;
  line2: string;
}

const fmtSecs = (s: number | null | undefined) => (!s ? '0 分' : Math.round(s / 60) + ' 分');
const round1 = (v: number) => Math.round(v * 10) / 10;

Page({
  data: {
    loading: true,
    loadErr: '',
    err: '',
    r: null as MockReportResp | null,
    heroLabel: '',
    smallText: '',
    statItems: [] as Array<{ label: string; value: string; unit?: string; tone?: string }>,
    goalText: '',
    goalOk: false,
    top25Text: '',
    top25Ok: false,
    modules: [] as ModVM[],
    history: [] as Array<{ id: number; score: number; h: number; cur: boolean }>,
    dist: [] as Array<{ h: number; me: boolean; label: number }>,
    bucketText: '',
  },
  _eventId: 0,

  onLoad(opt: Record<string, string>) {
    this._eventId = Number(opt.event_id || 0);
    if (!this._eventId) {
      this.setData({ loading: false, err: '链接缺少赛事参数，请从模考大赛页进入' });
      return;
    }
    this.load();
  },

  async load() {
    this.setData({ loadErr: '', err: '' });
    try {
      const r = await fetchMockReport(this._eventId);
      const max = Math.max(...(r.distribution || []), 1);
      this.setData({
        r,
        heroLabel: r.event.title + (r.event.phase === 'ended' ? '（排名已冻结）' : '（实时排名）'),
        smallText: r.small_sample
          ? '本场参赛 ' + r.total + ' 人，样本较少，排名仅供参考；历史同卷共 ' + r.history_pool.n + ' 人作答、平均 ' + r.history_pool.avg + ' 分（含比赛窗口外练习）'
          : '',
        statItems: [
          { label: '排名', value: r.rank + '/' + r.total, tone: 'brand' },
          { label: '击败', value: String(r.pct), unit: '%' },
          { label: '全场平均', value: String(r.avg), unit: '分' },
        ],
        goalText:
          r.target_score != null && r.gap_to_target != null
            ? r.gap_to_target <= 0 ? '已达标 🎉' : '还差 ' + r.gap_to_target + ' 分'
            : '',
        goalOk: r.gap_to_target != null && r.gap_to_target <= 0,
        top25Text:
          r.top25_score != null
            ? r.score >= r.top25_score ? '已进入前 25%' : '还差 ' + round1(r.top25_score - r.score) + ' 分'
            : '',
        top25Ok: r.top25_score != null && r.score >= r.top25_score,
        modules: (r.modules || []).map((m) => ({
          module: m.module,
          name: modName(m.module),
          pct: m.n ? Math.round((m.correct / m.n) * 100) : 0,
          line1: '答对 ' + m.correct + '/' + m.n + (m.avg_correct != null ? ' · 全场平均 ' + m.avg_correct : ''),
          line2: '用时 ' + fmtSecs(m.secs) + ' · 建议 ' + fmtSecs(m.rec_secs),
        })),
        history: (r.history || []).map((a) => ({ id: a.id, score: a.score, h: Math.max(8, a.score), cur: a.id === r.event.id })),
        dist: (r.distribution || []).map((n, i) => ({ h: n ? 15 + (n / max) * 85 : 4, me: i === r.my_bucket, label: i * 10 })),
        bucketText: '你在 ' + r.my_bucket * 10 + '-' + (r.my_bucket * 10 + 10) + ' 分段（高亮）',
      });
    } catch (e) {
      const msg = (e as Error).message || '';
      if (submitRetryable(msg)) this.setData({ loadErr: msg || '网络异常' });
      else this.setData({ err: msg || '报告不存在或已过期' });
    }
    this.setData({ loading: false });
  },
  retry() {
    this.setData({ loading: true });
    this.load();
  },
  goPractice(tag3: string | null, count: number | null) {
    const q: string[] = [];
    if (tag3) q.push('tag3=' + encodeURIComponent(tag3));
    if (count) q.push('count=' + count);
    wx.navigateTo({ url: '/pages/practice/practice' + (q.length ? '?' + q.join('&') : '') });
  },
  onWeakTag(e: WechatMiniprogram.TouchEvent) {
    this.goPractice(String(e.currentTarget.dataset.tag3 || '') || null, null);
  },
  goWeakPractice() {
    const r = this.data.r;
    const t = r && r.weak_tags[0];
    this.goPractice(t ? t.tag3 : null, 5);
  },
  openAttempt() {
    const r = this.data.r;
    if (r) wx.navigateTo({ url: '/pkgExam/report/report?attempt_id=' + r.attempt_id });
  },
  goContest() {
    wx.redirectTo({ url: '/pkgExam/contest/contest' });
  },
});
