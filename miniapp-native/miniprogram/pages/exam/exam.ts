import { fetchExamAttempts, fetchExamPapers } from '../../api/index';
import type { ExamAttemptItem, ExamPaper } from '../../api/types';
import { syncTabBar } from '../../utils/tabbar';
import { loadExamProgress } from '../../utils/exam-progress';

type PaperVM = ExamPaper & {
  yearShort: string;
  regionShort: string;
  bestText: string;
  sub: string;
};

type AttemptVM = ExamAttemptItem & { dateText: string; scoreText: string };

interface Chip {
  value: string;
  label: string;
}

function regionShortOf(region: string): string {
  if (!region) return '真题';
  if (region.indexOf('国考') > -1 || region.indexOf('国家') > -1) return '国考';
  if (region.indexOf('联考') > -1) return '联考';
  return region.slice(0, 2);
}

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.getMonth() + 1 + '月' + d.getDate() + '日';
}

function toVM(p: ExamPaper): PaperVM {
  const y = String(p.year || '');
  const parts: string[] = [];
  if (p.region) parts.push(p.region);
  parts.push(p.n + ' 题');
  if (p.duration_min) parts.push(p.duration_min + ' 分钟');
  if (p.takers) parts.push(p.takers + ' 人考过');
  return {
    ...p,
    yearShort: y.length === 4 ? y.slice(2) : y || '真题',
    regionShort: regionShortOf(String(p.region || '')),
    bestText: p.best_score != null ? p.best_score + ' 分' : '',
    sub: parts.join(' · '),
  };
}

const PAGE_SIZE = 20;

Page({
  data: {
    loading: true,
    loadErr: '',
    papers: [] as PaperVM[],
    pagedPapers: [] as PaperVM[],
    years: [] as Chip[],
    regions: [] as Chip[],
    year: '',
    region: '',
    /** 本地未交卷快照摘要（不把整卷题目投进视图层） */
    resume: null as { paperId: number | null; title: string; answered: number; total: number } | null,
    attempts: [] as AttemptVM[],
  },
  onShow() {
    syncTabBar(this, 2);
    this.syncResume();
    this.load();
    this.loadAttempts();
  },
  syncResume() {
    const snap = loadExamProgress();
    this.setData({
      resume: snap
        ? {
            paperId: snap.paperId,
            title: snap.paper.title,
            answered: snap.items.filter((q) => q._picked).length,
            total: snap.items.length,
          }
        : null,
    });
  },
  async load() {
    this.setData({ loadErr: '' });
    try {
      const d = await fetchExamPapers({
        year: this.data.year ? Number(this.data.year) : null,
        region: this.data.region || null,
      });
      const papers = (d.items || []).map(toVM);
      const f = d.filters || { years: [], regions: [] };
      this.setData({
        papers,
        pagedPapers: papers.slice(0, PAGE_SIZE),
        years: [{ value: '', label: '全部年份' }].concat(
          (f.years || []).map((y) => ({ value: String(y.y), label: String(y.y) }))
        ),
        regions: [{ value: '', label: '全部地区' }].concat(
          (f.regions || []).map((r) => ({ value: r.r, label: r.r }))
        ),
      });
    } catch (e) {
      this.setData({ loadErr: (e as Error).message || '网络错误' });
    } finally {
      this.setData({ loading: false });
    }
  },
  onMorePapers() {
    const n = this.data.pagedPapers.length + PAGE_SIZE;
    this.setData({ pagedPapers: this.data.papers.slice(0, n) });
  },
  async loadAttempts() {
    try {
      const d = await fetchExamAttempts(5);
      const attempts: AttemptVM[] = (d.items || []).map((a) => ({
        ...a,
        dateText: fmtDate(a.submitted_at),
        scoreText: a.score != null ? String(a.score) : '--',
      }));
      this.setData({ attempts });
    } catch {
      /* 历次记录是附属信息，失败不打断卷库展示 */
    }
  },
  onRetry() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    this.load();
  },
  onYear(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const k = String(e.detail.value ?? '');
    if (k === this.data.year) return;
    this.setData({ year: k, loading: true });
    this.load();
  },
  onRegion(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const k = String(e.detail.value ?? '');
    if (k === this.data.region) return;
    this.setData({ region: k, loading: true });
    this.load();
  },
  onPaperTap(e: WechatMiniprogram.TouchEvent) {
    const pid = Number(e.currentTarget.dataset.pid);
    const p = this.data.papers.find((x) => x.id === pid);
    if (!p) return;
    const snap = this.data.resume;
    if (snap && snap.paperId === pid) {
      this.onResume();
      return;
    }
    wx.showModal({
      title: p.title,
      content:
        p.n + ' 题 · 限时 ' + p.duration_min + ' 分钟，中途退出可续考。' +
        (p.best_score != null ? '\n本卷最好成绩 ' + p.best_score + ' 分。' : ''),
      confirmText: '开始模考',
      cancelText: '再看看',
      success: (r) => {
        if (r.confirm) wx.navigateTo({ url: '/pages/exam/mini?paper_id=' + pid });
      },
    });
  },
  onReport(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    if (id) wx.navigateTo({ url: '/pages/exam/report?attempt_id=' + id });
  },
  onResume() {
    const snap = this.data.resume;
    if (!snap) return;
    wx.navigateTo({
      url: snap.paperId ? '/pages/exam/mini?paper_id=' + snap.paperId : '/pages/exam/mini',
    });
  },
  onMini() {
    // 迷你模考：真实模考流程（attempt + 成绩报告 + 薄弱考点）
    wx.navigateTo({ url: '/pages/exam/mini' });
  },
});
