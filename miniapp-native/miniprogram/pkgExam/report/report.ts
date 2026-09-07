// 成绩报告：逐段对照 H5 pkgA/exam/report.vue（hero/统计/排名/目标差/模块得分/配速/历次/薄弱考点/逐题/错题重练/错因画像/下一卷/解析浮层）
import { patchMistake, postQuestionReport, deleteFav, fetchProfile } from '../../api/index';
import {
  addFav,
  fetchExamAttempts,
  fetchExamPapers,
  fetchExamRankQuick,
  fetchExamReportQuick,
} from '../../api/exam';
import type { ExamAttempt, ExamRankFull, ExamReportFull, ExamReportFullItem } from '../../api/exam-types';
import { modName } from '../../utils/stats';
import { imgUrl } from '../../utils/request';
import { paperAvgSecs } from '../../utils/kg-exam-timer';
import {
  MOD_ORDER,
  PACE_TAG,
  NAV_MODE_LABEL,
  buildExamRedoSet,
  buildPaceRows,
  examBoardRows,
  fmtMin,
  goalGap,
  markedNos,
  modAvgPct,
  nextNavMode,
  nextPaper,
  prevScoreDelta,
  qStatLine,
  qTimeLine,
  reviewStep,
  usedTimeText,
  weakModule,
  type BoardRow,
  type ModuleRow,
  type NavMode,
  type NextReco,
} from '../../utils/kg-exam-report';

interface PaceVM {
  key: string;
  name: string;
  status: string;
  tag: string;
  tone: 'bad' | 'ok' | 'neutral';
  pct: number;
  secsText: string;
  refText: string;
  refNote: string;
}

interface HistVM {
  id: number;
  score: number;
  h: number;
  cur: boolean;
}

interface QCell {
  no: number;
  cls: string;
}

interface DistVM {
  h: number;
  me: boolean;
  label: number;
}

interface StatItem {
  label: string;
  value: string;
  tone?: string;
}

interface DetailVM extends ExamReportFullItem {
  statusText: string;
  optList: Array<{ k: string; v: string }>;
  imgUrl: string;
  statLine: string;
  timeLine: string;
  faved: boolean;
  reported: boolean;
}

const REASON_OPTS = ['粗心大意', '概念不清', '方法不会', '纯蒙的'];
const REPORT_TYPES = ['答案错误', '解析错误', '题干或选项错字', '图片缺失', '分类错误', '重复题', '其他'];
const FAV_KEY = 'favQuestions';

function favList(): Array<{ question: string }> {
  const v = wx.getStorageSync(FAV_KEY);
  return Array.isArray(v) ? (v as Array<{ question: string }>) : [];
}

Page({
  data: {
    loading: true,
    loadErr: '',
    report: null as ExamReportFull | null,
    usedTime: '-',
    prevDeltaText: '',
    beatText: '',
    statItems: [] as StatItem[],
    rank: null as ExamRankFull | null,
    rankTiny: false,
    dist: [] as DistVM[],
    bucketText: '',
    board: null as BoardRow[] | null,
    goal: null as { target: number; gap: number; text: string; ok: boolean } | null,
    modules: [] as ModuleRow[],
    weakMod: null as { key: string; name: string; reason: string } | null,
    paceRows: [] as PaceVM[],
    history: [] as HistVM[],
    cells: [] as QCell[],
    markCount: 0,
    redoCount: 0,
    wrongTotal: 0,
    reasonRows: [] as Array<{ name: string; n: number; pct: number }>,
    nextReco: null as NextReco | null,
    nextDesc: '',
    detail: null as DetailVM | null,
    detailTitle: '',
    navMode: 'all' as NavMode,
    navLabel: NAV_MODE_LABEL.all,
    hasPrev: false,
    hasNext: false,
    reasonOpts: REASON_OPTS,
    qcOpen: false,
    qcTypes: REPORT_TYPES,
    qcType: '',
    qcDetail: '',
    qcBusy: false,
  },
  _aid: 0,
  _hist: [] as ExamAttempt[],
  _reported: null as unknown as Record<number, true>,

  onLoad(q: Record<string, string>) {
    this._hist = [];
    this._reported = {};
    const aid = Number(q.attempt_id || 0);
    if (!aid) {
      this.setData({ loading: false });
      return;
    }
    this.load(aid);
  },

  onShareAppMessage() {
    const r = this.data.report;
    if (!r || !r.paper || r.paper.kind !== 'zhenti') return { title: '考公错题助手 · 全真模考' };
    return {
      title: `我在《${r.paper.title}》答对 ${r.correct}/${r.total} 题，敢来挑战吗？`,
      path: '/pkgExam/list/list?pid=' + r.paper.id,
    };
  },

  async load(aid: number) {
    this._aid = aid;
    this.setData({ loading: true, loadErr: '', navMode: 'all', navLabel: NAV_MODE_LABEL.all, detail: null });
    try {
      const d = await fetchExamReportQuick(aid, 15000);
      this.setData({ report: d });
      this.derive(d, this.data.rank);
      this.loadRank(aid);
      this.loadHistory(d);
      this.loadProfile();
      this.loadNext(d);
    } catch (e) {
      const msg = (e as Error).message || '网络异常';
      this.setData({ report: null, loadErr: msg });
      wx.showToast({ title: '加载失败：' + msg, icon: 'none' });
    }
    this.setData({ loading: false });
  },

  derive(r: ExamReportFull, rank: ExamRankFull | null) {
    const a = r.attempt;
    const accuracy = r.answered ? Math.round((r.correct / r.answered) * 100) : 0;
    const fullAcc = r.total ? Math.round((r.correct / r.total) * 100) : 0;
    const statItems: StatItem[] = [
      { label: '已答正确率', value: accuracy + '%', tone: 'brand' },
      { label: '全卷正确率', value: fullAcc + '%' },
    ];
    if (rank && rank.rank && rank.total) statItems.push({ label: '同卷排名', value: rank.rank + '/' + rank.total });
    else statItems.push({ label: '答对', value: r.correct + '/' + r.total });

    const pm = a.per_module || {};
    const keys = MOD_ORDER.filter((k) => pm[k]).concat(Object.keys(pm).filter((k) => !MOD_ORDER.includes(k)));
    const modules: ModuleRow[] = keys.map((k) => ({
      key: k,
      name: modName(k),
      n: pm[k].n,
      correct: pm[k].correct,
      pct: pm[k].n ? Math.round((pm[k].correct / pm[k].n) * 100) : 0,
      avgPct: modAvgPct(rank, k),
      answered: pm[k].answered,
      ansPct: pm[k].answered ? Math.round((pm[k].correct / pm[k].answered) * 100) : undefined,
    }));
    const order = (k: string) => {
      const i = MOD_ORDER.indexOf(k);
      return i < 0 ? MOD_ORDER.length : i;
    };
    const paceRows: PaceVM[] = buildPaceRows(pm, r.paper.duration_min, r.total)
      .sort((x, y) => order(x.key) - order(y.key))
      .map((p) => ({
        key: p.key,
        name: modName(p.key),
        status: p.status,
        tag: PACE_TAG[p.status] || PACE_TAG.ok,
        tone: p.status === 'over' ? 'bad' : p.status === 'ok' ? 'ok' : 'neutral',
        secsText: fmtMin(p.secs),
        refText: fmtMin(p.refSecs),
        refNote: p.status !== 'skip' && p.answered < p.n ? '（按已答 ' + p.answered + '/' + p.n + ' 题折算）' : '',
        pct: p.status === 'skip' ? 0 : Math.max(4, Math.round((p.secs / Math.max(p.secs, p.refSecs, 1)) * 100)),
      }));

    const items = r.items || [];
    const cells: QCell[] = items.map((it) => ({
      no: it.no,
      cls: (it.picked ? (it.correct ? 'ok' : 'bad') : 'blank') + (it.marked ? ' mk' : ''),
    }));
    const wrong = items.filter((it) => it.picked && !it.correct);
    const cnt: Record<string, number> = {};
    for (const it of wrong) {
      const k = it.error_reason && REASON_OPTS.includes(it.error_reason) ? it.error_reason : '未标注';
      cnt[k] = (cnt[k] || 0) + 1;
    }
    const reasonRows = Object.keys(cnt)
      .map((name) => ({ name, n: cnt[name], pct: Math.round((cnt[name] / wrong.length) * 100) }))
      .sort((x, y) => y.n - x.n);

    const beatText = rank && rank.total >= 10 && rank.beaten_pct != null ? '击败 ' + rank.beaten_pct + '% 考生' : '';
    let dist: DistVM[] = [];
    if (rank && Array.isArray(rank.distribution)) {
      const max = Math.max(...rank.distribution, 1);
      dist = rank.distribution.map((n, i) => ({ h: n ? 15 + (n / max) * 85 : 4, me: i === rank.my_bucket, label: i * 10 }));
    }
    const mb = rank && rank.my_bucket != null ? rank.my_bucket : null;

    this.setData({
      usedTime: usedTimeText(a.started_at, a.submitted_at),
      statItems,
      beatText,
      rankTiny: !!rank && rank.total < 10,
      dist,
      bucketText: mb != null ? '你在 ' + mb * 10 + '-' + (mb * 10 + 10) + ' 分段（蓝色）' : '',
      board: examBoardRows(rank),
      modules,
      weakMod: weakModule(modules),
      paceRows,
      cells,
      markCount: markedNos(items).length,
      redoCount: buildExamRedoSet(items).length,
      wrongTotal: wrong.length,
      reasonRows,
    });
  },

  async loadRank(aid: number) {
    try {
      const rank = await fetchExamRankQuick(aid);
      if (this._aid !== aid) return;
      this.setData({ rank });
      if (this.data.report) this.derive(this.data.report, rank);
    } catch (e) {
      this.setData({ rank: null });
    }
  },

  async loadHistory(r: ExamReportFull) {
    try {
      const d = await fetchExamAttempts(r.paper.id, 10);
      const hist = (d.items || []).slice().reverse();
      this._hist = hist;
      const delta = prevScoreDelta(hist, r.attempt.id);
      this.setData({
        history: hist.map((h) => ({
          id: h.id,
          score: Number(h.score) || 0,
          h: Math.max(8, Number(h.score) || 0),
          cur: h.id === r.attempt.id,
        })),
        prevDeltaText: !delta ? '' : delta.delta > 0 ? '+' + delta.delta + ' 分' : delta.delta < 0 ? delta.delta + ' 分' : '持平',
      });
    } catch (e) {
      /* 非关键路径 */
    }
  },

  async loadProfile() {
    try {
      const d = await fetchProfile();
      const target = d.profile && d.profile.target_score != null ? d.profile.target_score : null;
      const r = this.data.report;
      const g = r ? goalGap(r.attempt.score, target) : null;
      this.setData({
        goal: g ? { ...g, ok: g.gap <= 0, text: g.gap <= 0 ? '已达标 🎉' : '还差 ' + g.gap + ' 分' } : null,
      });
    } catch (e) {
      /* 未设/失败不渲染 */
    }
  },

  async loadNext(r: ExamReportFull) {
    try {
      const [papers, attempts] = await Promise.all([fetchExamPapers({ kind: 'zhenti' }), fetchExamAttempts()]);
      const n = nextPaper(papers.items, attempts.items, r.paper);
      this.setData({
        nextReco: n,
        nextDesc: !n
          ? ''
          : n.takers > 0
            ? '已有 ' + n.takers + ' 人模考' + (n.avgScore != null ? ' · 平均 ' + n.avgScore + ' 分' : '')
            : '换一卷继续练手感',
      });
    } catch (e) {
      /* 非关键路径 */
    }
  },

  onReload() {
    if (this._aid) this.load(this._aid);
  },
  goList() {
    wx.redirectTo({ url: '/pkgExam/list/list' });
  },
  retake() {
    const p = this.data.report && this.data.report.paper;
    if (!p) return;
    wx.redirectTo({ url: p.kind === 'mock' ? '/pkgExam/exam/exam?mini=1' : '/pkgExam/exam/exam?paper_id=' + p.id });
  },
  goNext() {
    const n = this.data.nextReco;
    if (n) wx.navigateTo({ url: '/pkgExam/list/list?pid=' + n.id });
  },
  goWeak() {
    const w = this.data.weakMod;
    if (w) wx.navigateTo({ url: '/pages/practice/practice?module=' + w.key + '&count=10' });
  },
  onWeakTag(e: WechatMiniprogram.TouchEvent) {
    const tag3 = String(e.currentTarget.dataset.tag3 || '');
    wx.navigateTo({ url: '/pages/practice/practice?count=10' + (tag3 ? '&tag3=' + encodeURIComponent(tag3) : '') });
  },
  redoWrong() {
    const r = this.data.report;
    if (!r) return;
    const set = buildExamRedoSet(r.items);
    if (!set.length) return;
    wx.setStorageSync('redoSet', set);
    wx.navigateTo({ url: '/pages/practice/practice?mode=redoset' });
  },
  onHistory(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id || (this.data.report && id === this.data.report.attempt.id)) return;
    this.load(id);
  },
  goBook() {
    wx.switchTab({ url: '/pages/book/book' });
  },

  // ---------- 解析浮层 ----------
  openQ(it: ExamReportFullItem) {
    const r = this.data.report;
    if (!r) return;
    const o = it.options || {};
    const question = it.question;
    const faved = favList().some((f) => f && f.question === question);
    const detail: DetailVM = {
      ...it,
      statusText: it.correct ? '答对' : it.picked ? '答错' : '未答',
      optList: Object.keys(o).map((k) => ({ k, v: String(o[k] == null ? '' : o[k]) })),
      imgUrl: imgUrl(it.image),
      statLine: qStatLine(it),
      timeLine: qTimeLine(it.secs, paperAvgSecs(r.items)),
      faved,
      reported: !!(it.question_id && this._reported && this._reported[it.question_id]),
    };
    this.setData({
      detail,
      detailTitle: '第 ' + it.no + ' 题 · ' + detail.statusText,
      hasPrev: !!reviewStep(r.items, it.no, -1, this.data.navMode),
      hasNext: !!reviewStep(r.items, it.no, 1, this.data.navMode),
    });
  },
  onCell(e: WechatMiniprogram.TouchEvent) {
    const no = Number(e.currentTarget.dataset.no);
    const it = this.data.report && this.data.report.items.find((x) => x.no === no);
    if (it) this.openQ(it);
  },
  onDetailClose() {
    this.setData({ detail: null });
  },
  onPrevQ() {
    this.stepQ(-1);
  },
  onNextQ() {
    this.stepQ(1);
  },
  stepQ(dir: 1 | -1) {
    const r = this.data.report;
    const d = this.data.detail;
    if (!r || !d) return;
    const nxt = reviewStep(r.items, d.no, dir, this.data.navMode);
    if (nxt) this.openQ(nxt);
  },
  cycleNavMode() {
    const navMode = nextNavMode(this.data.navMode, this.data.markCount > 0);
    this.setData({ navMode, navLabel: NAV_MODE_LABEL[navMode] });
    const r = this.data.report;
    const d = this.data.detail;
    if (r && d) {
      this.setData({
        hasPrev: !!reviewStep(r.items, d.no, -1, navMode),
        hasNext: !!reviewStep(r.items, d.no, 1, navMode),
      });
    }
  },
  onPreviewImg() {
    const d = this.data.detail;
    if (d && d.imgUrl) wx.previewImage({ urls: [d.imgUrl] });
  },
  toggleDetailFav() {
    const d = this.data.detail;
    if (!d || !d.question) return;
    const list = favList();
    const i = list.findIndex((f) => f && f.question === d.question);
    let added = false;
    if (i >= 0) list.splice(i, 1);
    else {
      added = true;
      list.unshift({
        t: Date.now(),
        question: d.question,
        options: d.options,
        answer: d.answer,
        explanation: d.explanation,
        hs_explanation: d.hs_explanation,
        module: d.module,
        submodule: d.submodule,
        is_real: d.is_real,
        exam_year: d.exam_year,
        exam_region: d.exam_region,
        image: d.image,
        image_credit: d.image_credit,
      } as { question: string });
      if (list.length > 200) list.length = 200;
    }
    wx.setStorageSync(FAV_KEY, list);
    if (d.question_id) (added ? addFav(d.question_id) : deleteFav(d.question_id)).catch(() => {});
    this.setData({ 'detail.faved': added });
    wx.showToast({ title: added ? '已收藏，可在收藏与笔记查看' : '已取消收藏', icon: 'none', duration: 900 });
  },
  async onReason(e: WechatMiniprogram.TouchEvent) {
    const rz = String(e.currentTarget.dataset.rz || '');
    const d = this.data.detail;
    if (!d || !d.mistake_id || !rz || d.error_reason === rz) return;
    const prev = d.error_reason || null;
    this.setData({ 'detail.error_reason': rz });
    try {
      await patchMistake(d.mistake_id, { error_reason: rz });
      const r = this.data.report;
      if (r) {
        const it = r.items.find((x) => x.no === d.no);
        if (it) it.error_reason = rz;
        this.derive(r, this.data.rank);
      }
    } catch (err) {
      this.setData({ 'detail.error_reason': prev });
      wx.showToast({ title: '错因保存失败：' + (err as Error).message, icon: 'none' });
    }
  },
  reinforceDetail() {
    const d = this.data.detail;
    if (!d || !d.tag3) return;
    const q = ['count=5', 'source=exam_report', 'tag3=' + encodeURIComponent(d.tag3)];
    if (d.module) q.push('module=' + d.module);
    if (d.submodule) q.push('submodule=' + encodeURIComponent(d.submodule));
    wx.navigateTo({ url: '/pages/practice/practice?' + q.join('&') });
  },

  // ---------- 纠错 ----------
  openQc() {
    const d = this.data.detail;
    if (!d || !d.question_id || d.reported) return;
    this.setData({ qcOpen: true, qcType: '', qcDetail: '' });
  },
  onQcClose() {
    this.setData({ qcOpen: false });
  },
  onQcType(e: WechatMiniprogram.TouchEvent) {
    this.setData({ qcType: String(e.currentTarget.dataset.t || '') });
  },
  onQcInput(e: WechatMiniprogram.Input) {
    this.setData({ qcDetail: e.detail.value });
  },
  async submitQc() {
    const d = this.data.detail;
    const qid = d && d.question_id;
    if (!qid || !this.data.qcType || this.data.qcBusy) return;
    this.setData({ qcBusy: true });
    try {
      await postQuestionReport(qid, this.data.qcType, this.data.qcDetail.slice(0, 500));
      this._reported = { ...(this._reported || {}), [qid]: true };
      this.setData({ qcOpen: false, 'detail.reported': true });
      wx.showToast({ title: '感谢反馈，我们会尽快核查', icon: 'none' });
    } catch (e) {
      wx.showToast({ title: '提交失败：' + (e as Error).message, icon: 'none' });
    }
    this.setData({ qcBusy: false });
  },
});
