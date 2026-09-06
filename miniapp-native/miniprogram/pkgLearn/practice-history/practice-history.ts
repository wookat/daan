// 练习历史（对齐 H5 pkgA/stats/practice-history.vue）：/api/practice/history 按日分组 + /api/practice/history/detail 逐题回看 + 重练本次错题
import {
  fetchPracticeHistory,
  fetchPracticeHistoryDetail,
  type HistoryDetailItem,
  type HistorySession,
} from '../../api/learn';
import { trackEvent } from '../../api/index';
import type { Question } from '../../api/types';
import { askPrefill, openExplain } from '../../utils/ask-prefill';
import { modName } from '../../utils/stats';

// module-meta 只收录题库 5 模块；练习历史里还会出现申论/时政会话
const EXTRA_NAMES: Record<string, string> = { shenlun: '申论', shizheng: '时事政治' };

interface SessionVM {
  i: number;
  start: number;
  end: number;
  time: string;
  modules: Array<{ m: string; name: string }>;
  n: number;
  dur: string;
  pct: number;
  pctCls: string;
}
interface GroupVM {
  day: string;
  list: SessionVM[];
}
interface DetailVM {
  correct: boolean;
  title: string;
  ans: string;
  secs: number;
  hasQ: boolean;
  optList: Array<{ k: string; v: string }>;
  answer: string;
  picked: string;
  ansLine: string;
  expl: string;
}

function name(m: string | null | undefined): string {
  if (!m) return '混合';
  return EXTRA_NAMES[m] || modName(m);
}
function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDur(s: number): string {
  if (!s) return '0"';
  const m = Math.floor(s / 60);
  return m ? m + "'" + pad(s % 60) + '"' : s + '"';
}
function fmtDay(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, now)) return '今天';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (same(d, y)) return '昨天';
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

function toGroups(items: HistorySession[]): GroupVM[] {
  const out: GroupVM[] = [];
  items.forEach((s, i) => {
    const day = fmtDay(s.start);
    let g = out[out.length - 1];
    if (!g || g.day !== day) {
      g = { day, list: [] };
      out.push(g);
    }
    const pct = s.n ? Math.round((s.correct / s.n) * 100) : 0;
    g.list.push({
      i,
      start: s.start,
      end: s.end,
      time: fmtTime(s.start),
      modules: (s.modules || []).map((m) => ({ m, name: name(m) })),
      n: s.n,
      dur: fmtDur(s.secs),
      pct,
      pctCls: pct >= 80 ? 'hi' : pct < 60 ? 'lo' : '',
    });
  });
  return out;
}

function toDetail(d: HistoryDetailItem): DetailVM {
  const q = d.question;
  const picked = d.picked || '';
  return {
    correct: !!d.correct,
    title: q ? q.question : d.submodule || name(d.module),
    ans: !d.correct && picked ? '我的答案 ' + picked + (q && q.answer ? ' · 正解 ' + q.answer : '') : '',
    secs: d.secs || 0,
    hasQ: !!q,
    optList: q
      ? Object.keys(q.options || {})
          .sort()
          .map((k) => ({ k, v: q.options[k] }))
      : [],
    answer: q ? q.answer : '',
    picked,
    ansLine: q ? '正确答案 ' + q.answer + (picked ? ' · 我的答案 ' + picked : '') : '',
    expl: q ? q.hs_explanation || q.explanation || '' : '',
  };
}

Page({
  data: {
    groups: [] as GroupVM[],
    total: 0,
    loaded: false,
    loadErr: '',
    openIdx: -1,
    detail: [] as DetailVM[],
    detailLoading: false,
    openDetailIdx: -1,
    wrongN: 0,
  },
  _items: [] as HistorySession[],
  _detail: [] as HistoryDetailItem[],

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loadErr: '' });
    try {
      const d = await fetchPracticeHistory();
      this._items = d.items || [];
      this.setData({ groups: toGroups(this._items), total: this._items.length, loaded: true });
    } catch (e) {
      const msg = (e as Error).message || '网络异常';
      this.setData({ loadErr: msg, loaded: true });
      wx.showToast({ title: msg, icon: 'none' });
    }
  },
  onRetry() {
    this.load();
  },

  async onToggle(e: WechatMiniprogram.TouchEvent) {
    const i = Number((e.currentTarget.dataset as { i: number }).i);
    if (this.data.openIdx === i) {
      this.setData({ openIdx: -1 });
      return;
    }
    this._detail = [];
    this.setData({ openIdx: i, openDetailIdx: -1, detail: [], wrongN: 0, detailLoading: true });
    const s = this._items[i];
    if (!s) return;
    try {
      const d = await fetchPracticeHistoryDetail(s.start, s.end);
      if (this.data.openIdx !== i) return;
      this._detail = d.items || [];
      this.setData({ detail: this._detail.map(toDetail), wrongN: this.wrongQs().length });
    } catch (e) {
      wx.showToast({ title: (e as Error).message || '加载失败', icon: 'none' });
    }
    if (this.data.openIdx === i) this.setData({ detailLoading: false });
  },

  onToggleDetail(e: WechatMiniprogram.TouchEvent) {
    const j = Number((e.currentTarget.dataset as { j: number }).j);
    const d = this._detail[j];
    if (!d || !d.question) return;
    this.setData({ openDetailIdx: this.data.openDetailIdx === j ? -1 : j });
  },

  wrongQs(): Question[] {
    const seen = new Set<number>();
    const out: Question[] = [];
    this._detail.forEach((d) => {
      if (!d.correct && d.question && d.question.id && !seen.has(d.question.id)) {
        seen.add(d.question.id);
        out.push(d.question);
      }
    });
    return out;
  },

  onAsk(e: WechatMiniprogram.TouchEvent) {
    const j = Number((e.currentTarget.dataset as { j: number }).j);
    const d = this._detail[j];
    const q = d && d.question;
    if (!q) return;
    const text = askPrefill(q.question, q.options);
    if (!text) return;
    trackEvent('history_ask_click', d.module || '');
    openExplain({ text, qid: q.id, answer: d.picked || '', qtype: q.submodule || null });
  },

  onRedoWrong() {
    const qs = this.wrongQs();
    if (!qs.length) return;
    wx.setStorageSync('redoSet', qs);
    wx.navigateTo({ url: '/pages/practice/practice?mode=redoset' });
  },
  onGoPractice() {
    wx.navigateTo({ url: '/pages/practice/practice' });
  },
});
