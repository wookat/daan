// 模考 tab：焦点（未交卷续考 / 迷你模考）+ 更多模考 4 格 + 最近成绩 + 真题卷库预览（前 20 卷，完整卷库与筛选在 pkgExam/list）
import { fetchExamPapers, fetchExamAttempts, examResume, examProgressDrop } from '../../api/exam';
import type { ExamPaper, ExamAttempt } from '../../api/exam-types';
import { type ResumeInfo, resolveResume, dropResume, resumeUrl } from '../../utils/kg-exam-progress';
import { fmtClock } from '../../utils/kg-exam-timer';
import { fmtTs } from '../../utils/cn-date';
import { syncTabBar } from '../../utils/tabbar';

type PaperVM = ExamPaper & { subText: string };
type AttemptVM = { id: number; title: string; desc: string; scoreText: string; scoreTone: string };

const PREVIEW_N = 20;
const RECENT_N = 3;

function toVM(p: ExamPaper): PaperVM {
  const parts: string[] = [];
  if (p.year) parts.push(String(p.year));
  if (p.region) parts.push(String(p.region));
  if (p.n) parts.push(p.n + ' 题');
  return { ...p, subText: parts.join('　') };
}

function attemptVM(a: ExamAttempt): AttemptVM {
  const score = a.score;
  const has = score !== null && score !== undefined;
  let n = 0;
  let correct = 0;
  for (const k in a.per_module || {}) {
    const pm = a.per_module![k];
    n += pm.n || 0;
    correct += pm.correct || 0;
  }
  return {
    id: a.id,
    title: a.kind === 'mock' ? '迷你模考' : a.title || '模考',
    desc: fmtTs(a.submitted_at || a.started_at) + (n ? '　答对 ' + correct + '/' + n : ''),
    scoreText: has ? score + ' 分' : '未交卷',
    scoreTone: has ? (Number(score) >= 60 ? 'ok' : 'warn') : 'muted',
  };
}

Page({
  data: {
    loading: true,
    loadErr: '',
    papers: [] as PaperVM[],
    total: 0,
    recent: [] as AttemptVM[],
    examResume: null as (ResumeInfo & { leftText: string }) | null,
    entries: [
      { key: 'papers', icon: 'files', label: '真题卷库' },
      { key: 'contest', icon: 'trophy', label: '模考大赛' },
      { key: 'shenlun', icon: 'pen-line', label: '申论' },
      { key: 'history', icon: 'clipboard-list', label: '模考记录' },
    ],
  },
  onShow() {
    syncTabBar(this, 2);
    this.load();
    this.loadResume();
    this.loadRecent();
  },
  onShareAppMessage() {
    return { title: '考公行测真题卷库 · 整卷全真模考', path: '/pages/exam/exam' };
  },
  async load() {
    this.setData({ loadErr: '' });
    try {
      const d = await fetchExamPapers();
      const items = d.items || [];
      this.setData({ papers: items.slice(0, PREVIEW_N).map(toVM), total: items.length });
    } catch (e) {
      this.setData({ loadErr: (e as Error).message || '网络错误' });
    } finally {
      this.setData({ loading: false });
    }
  },
  // 与首页 examResume 同源：本机 examProgress 优先，否则 /api/exam/resume
  async loadResume() {
    const r = await resolveResume(examResume);
    this.setData({ examResume: r ? { ...r, leftText: fmtClock(r.leftSecs) } : null });
  },
  async loadRecent() {
    try {
      const d = await fetchExamAttempts(null, RECENT_N);
      this.setData({ recent: (d.items || []).filter((a) => a.submitted_at).slice(0, RECENT_N).map(attemptVM) });
    } catch (e) {
      /* 非关键路径 */
    }
  },
  onRetry() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    this.load();
  },
  onResumeExam() {
    const r = this.data.examResume;
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
        dropResume(this.data.examResume, examProgressDrop);
        this.setData({ examResume: null });
      },
    });
  },
  onEntry(e: WechatMiniprogram.CustomEvent<{ key: string }>) {
    const k = e.detail.key;
    if (k === 'papers') this.onAllPapers();
    else if (k === 'contest') this.onContest();
    else if (k === 'shenlun') this.onShenlun();
    else if (k === 'history') this.onAllAttempts();
  },
  onAttemptTap(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    if (id) wx.navigateTo({ url: '/pkgExam/report/report?attempt_id=' + id });
  },
  onAllAttempts() {
    wx.navigateTo({ url: '/pkgExam/list/list' });
  },
  onPaperTap(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    wx.navigateTo({ url: '/pkgExam/list/list?pid=' + id });
  },
  onAllPapers() {
    wx.navigateTo({ url: '/pkgExam/list/list' });
  },
  onMini() {
    wx.navigateTo({ url: '/pkgExam/exam/exam?mini=1' });
  },
  onContest() {
    wx.navigateTo({ url: '/pkgExam/contest/contest' });
  },
  onShenlun() {
    wx.navigateTo({ url: '/pkgExam/shenlun/shenlun' });
  },
});
