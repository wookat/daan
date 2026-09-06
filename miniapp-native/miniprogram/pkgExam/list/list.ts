// 真题卷库（对齐 H5 pkgA/exam/list.vue）：/api/exam/papers 列表 + 年份/地区/做题状态筛选，每批 20 卷，深链 year/region/st/pid
import {
  fetchExamPapers,
  fetchExamAttempts,
  fetchExamPaperDetail,
  examResume,
  examProgressDrop,
  exportPdf,
} from '../../api/exam';
import type { ExamPaper, ExamPaperFilters, ExamAttempt } from '../../api/exam-types';
import { type ResumeInfo, resolveResume, dropResume, resumeUrl } from '../../utils/kg-exam-progress';
import { fmtClock } from '../../utils/kg-exam-timer';

const PAGE = 20;
const ST_OPTS = [
  { value: '', label: '全部' },
  { value: 'todo', label: '没考过' },
  { value: 'done', label: '考过的' },
];

type PaperVM = ExamPaper & {
  metaText: string;
  bestText: string;
  practicedText: string;
  practicedDone: boolean;
};

interface AttemptVM extends ExamAttempt {
  timeText: string;
}

interface ListOpts {
  year: number;
  region: string;
  pid: number;
  st: '' | 'todo' | 'done';
}

function parseListOpts(o: Record<string, string>): ListOpts {
  const y = Number(o.year);
  let region = '';
  try {
    region = typeof o.region === 'string' ? decodeURIComponent(o.region).trim() : '';
  } catch (e) {
    region = '';
  }
  const pid = Number(o.pid);
  return {
    year: Number.isInteger(y) && y >= 1990 && y <= 2099 ? y : 0,
    region,
    pid: Number.isInteger(pid) && pid > 0 ? pid : 0,
    st: o.st === 'todo' || o.st === 'done' ? o.st : '',
  };
}

// 与 H5 exam-list-status.js 一致：todo=没考过（best_score 为空），done=考过的
function filterByStatus(items: PaperVM[], st: string): PaperVM[] {
  if (st !== 'todo' && st !== 'done') return items;
  return items.filter((p) => (st === 'todo' ? p.best_score == null : p.best_score != null));
}

// 与 H5 paper-continue.js paperPracticedState 一致
function practicedState(practiced?: number, n?: number, wrong?: number): { show: boolean; done: boolean; text: string } {
  const p = Number.isInteger(practiced) ? (practiced as number) : 0;
  const total = Number.isInteger(n) ? (n as number) : 0;
  if (total <= 0 || p <= 0) return { show: false, done: false, text: '' };
  const w = Number.isInteger(wrong) && (wrong as number) > 0 && (wrong as number) <= p ? ` · 错 ${wrong} 题` : '';
  if (p >= total) return { show: true, done: true, text: `已练完全部 ${total} 题 ✓${w}` };
  return { show: true, done: false, text: `已练 ${p}/${total} 题${w}` };
}

function toVM(p: ExamPaper): PaperVM {
  const takers = p.takers
    ? ' · ' + p.takers + ' 人考过' + (p.avg_score != null ? ' · 平均 ' + p.avg_score + ' 分' : '')
    : '';
  const ps = practicedState(p.practiced, p.n, p.wrong);
  return {
    ...p,
    metaText: p.n + ' 题 · ' + p.duration_min + ' 分钟' + takers,
    bestText: p.best_score != null ? '我的最好成绩 ' + p.best_score + ' 分 · 已考 ' + (p.attempt_count || 0) + ' 次' : '',
    practicedText: p.psource && ps.show ? ps.text : '',
    practicedDone: ps.done,
  };
}

function fmtTime(t?: number | null): string {
  if (!t) return '';
  const d = new Date(t * 1000);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

Page({
  data: {
    loading: true,
    loadErr: '',
    items: [] as PaperVM[],
    shown: [] as PaperVM[],
    visible: [] as PaperVM[],
    filters: { years: [], regions: [] } as ExamPaperFilters,
    yearOpts: [] as Array<{ value: number | string; label: string }>,
    regionOpts: [] as Array<{ value: string; label: string }>,
    stOpts: ST_OPTS,
    year: '' as number | '',
    region: '',
    st: '' as '' | 'todo' | 'done',
    hasFilter: false,
    prog: { done: 0, total: 0, pct: 0 },
    pinnedId: 0,
    scrollTo: '',
    pageN: 1,
    resume: null as (ResumeInfo & { leftText: string }) | null,
    attempts: [] as AttemptVM[],
    menuPaper: null as PaperVM | null,
    menuOpen: false,
    exportTarget: null as PaperVM | null,
    exporting: false,
  },
  _pending: null as ListOpts | null,
  _pendingPid: 0,

  onLoad(opt: Record<string, string>) {
    const p = parseListOpts(opt);
    this._pending = p;
    this._pendingPid = p.pid;
    if (p.st) this.setData({ st: p.st, hasFilter: true });
  },
  onShow() {
    this.load();
    this.loadAttempts();
    this.loadResume();
  },
  onShareAppMessage() {
    return { title: '考公行测真题卷库 · 整卷全真模考', path: '/pages/exam/exam' };
  },

  async load() {
    this.setData({ loadErr: '', loading: !this.data.items.length });
    try {
      const d = await fetchExamPapers({
        year: this.data.year ? Number(this.data.year) : undefined,
        region: this.data.region || undefined,
      });
      const items = (d.items || []).map(toVM);
      const filters = d.filters || { years: [], regions: [] };
      const done = items.filter((p) => p.best_score != null).length;
      this.setData({
        items,
        filters,
        yearOpts: ([{ value: '', label: '全部年份' }] as Array<{ value: number | string; label: string }>).concat(
          (filters.years || []).map((y) => ({ value: y.y, label: y.y + '年' }))
        ),
        regionOpts: [{ value: '', label: '全部地区' }].concat((filters.regions || []).map((r) => ({ value: r.r, label: r.r }))),
        prog: { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 },
      });
      if (this.applyPendingFilter()) return;
      this.recompute();
      this.applyPendingPin();
    } catch (e) {
      this.setData({ loadErr: (e as Error).message || '网络异常' });
    }
    this.setData({ loading: false });
  },
  recompute() {
    const shown = filterByStatus(this.data.items, this.data.st);
    this.setData({
      shown,
      visible: shown.slice(0, this.data.pageN * PAGE),
      hasFilter: !!(this.data.year || this.data.region || this.data.st),
    });
  },
  // 入向深链：filters 真实返回后按白名单应用一次（非法忽略），应用则重拉列表
  applyPendingFilter(): boolean {
    const p = this._pending;
    if (!p) return false;
    this._pending = null;
    const f = this.data.filters;
    const y = p.year && (f.years || []).some((o) => o.y === p.year) ? p.year : 0;
    const r = p.region && (f.regions || []).some((o) => o.r === p.region) ? p.region : '';
    if (!y && !r) return false;
    this.setData({ year: y || '', region: r });
    this.load();
    return true;
  },
  // 入向定位深链：列表含目标卷则高亮 + 展开到所在批次 + 滚动定位
  applyPendingPin() {
    const pid = this._pendingPid;
    if (!pid) return;
    this._pendingPid = 0;
    const at = this.data.shown.findIndex((p) => p.id === pid);
    if (at < 0) return;
    const pageN = Math.max(this.data.pageN, Math.floor(at / PAGE) + 1);
    this.setData({ pinnedId: pid, pageN });
    this.recompute();
    setTimeout(() => this.setData({ scrollTo: 'paper-' + pid }), 80);
  },
  async loadAttempts() {
    try {
      const d = await fetchExamAttempts();
      this.setData({ attempts: (d.items || []).slice(0, 10).map((a) => ({ ...a, timeText: fmtTime(a.submitted_at) })) });
    } catch (e) {
      /* 非关键路径 */
    }
  },
  async loadResume() {
    const r: ResumeInfo | null = await resolveResume(examResume);
    this.setData({ resume: r ? { ...r, leftText: fmtClock(r.leftSecs) } : null });
  },
  onContinue() {
    const r = this.data.resume;
    if (r) wx.navigateTo({ url: resumeUrl(r) });
  },
  onDropResume() {
    wx.showModal({
      title: '放弃未交卷进度？',
      content: '放弃后本次作答记录不再保留',
      confirmText: '放弃',
      cancelText: '再想想',
      success: (res) => {
        if (!res.confirm) return;
        dropResume(this.data.resume, examProgressDrop);
        this.setData({ resume: null });
      },
    });
  },

  // ---------- 筛选 ----------
  onSt(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const v = e.detail.value;
    this.setData({ st: v === 'todo' || v === 'done' ? v : '', pinnedId: 0, pageN: 1 });
    this.recompute();
  },
  onYear(e: WechatMiniprogram.CustomEvent<{ value: number | string }>) {
    this.setData({ year: e.detail.value === '' ? '' : Number(e.detail.value), pinnedId: 0, pageN: 1 });
    this.load();
  },
  onRegion(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ region: e.detail.value || '', pinnedId: 0, pageN: 1 });
    this.load();
  },
  onClearFilters() {
    this.setData({ st: '', year: '', region: '', pinnedId: 0, pageN: 1 });
    this.load();
  },
  onEmptyCta() {
    if (this.data.hasFilter) this.onClearFilters();
    else this.onMini();
  },
  onMore() {
    this.setData({ pageN: this.data.pageN + 1 });
    this.recompute();
  },
  onRetry() {
    this.setData({ loading: true });
    this.load();
  },

  // ---------- 开考 / 菜单 ----------
  onMini() {
    wx.navigateTo({ url: '/pkgExam/exam/exam?mini=1' });
  },
  onStart(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    wx.navigateTo({ url: '/pkgExam/exam/exam?paper_id=' + id });
  },
  onMenu(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    const p = this.data.items.find((x) => x.id === id) || null;
    if (!p) return;
    this.setData({ menuPaper: p, menuOpen: true });
  },
  onMenuClose() {
    this.setData({ menuOpen: false });
  },
  onPractice() {
    const p = this.data.menuPaper;
    this.setData({ menuOpen: false });
    if (!p || !p.psource) return;
    wx.navigateTo({
      url: '/pkgExam/exam/exam?mode=practice&pid=' + p.id + '&src=' + encodeURIComponent(p.psource),
    });
  },
  onBestReport() {
    const p = this.data.menuPaper;
    this.setData({ menuOpen: false });
    if (!p || !p.best_attempt_id) return;
    wx.navigateTo({ url: '/pkgExam/report/report?attempt_id=' + p.best_attempt_id });
  },
  onAskExport() {
    const p = this.data.menuPaper;
    this.setData({ menuOpen: false });
    if (!p || this.data.exporting) return;
    this.setData({ exportTarget: p });
  },
  onExportClose() {
    if (this.data.exporting) return;
    this.setData({ exportTarget: null });
  },
  async onExport(
    e: WechatMiniprogram.CustomEvent<{ include_answers: boolean; answer_sheet: boolean; include_questions: boolean }>
  ) {
    const p = this.data.exportTarget;
    if (!p || this.data.exporting) return;
    this.setData({ exporting: true });
    try {
      const d = await fetchExamPaperDetail(p.id);
      await exportPdf({ title: p.title, question_ids: d.paper.question_ids, ...e.detail });
      this.setData({ exportTarget: null });
    } catch (err) {
      wx.showToast({ title: '导出失败：' + (err as Error).message, icon: 'none' });
    }
    this.setData({ exporting: false });
  },
  onAttempt(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    if (id) wx.navigateTo({ url: '/pkgExam/report/report?attempt_id=' + id });
  },
});
