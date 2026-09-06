// 搜索页（对齐 H5 pkgA/search/search.vue）：/api/search 五 tab 联合搜索 + /api/search/question/{id} 详情展开 + 考点深链到 practice
import {
  search,
  searchQuestion,
  type SearchBrief,
  type SearchDetail,
  type SearchResp,
} from '../../api/learn';
import { askPrefill, openExplain } from '../../utils/ask-prefill';
import { modName } from '../../utils/stats';
import { trackEvent } from '../../api/index';

const HIST_KEY = 'kgSearchHist';
const TABS = [
  { value: 'all', label: '全部' },
  { value: 'question', label: '题目' },
  { value: 'topic', label: '考点' },
  { value: 'paper', label: '试卷' },
  { value: 'shenlun', label: '申论' },
];
const MODS: Record<string, string> = { shenlun: '申论' };

interface Seg {
  t: string;
  hi: boolean;
}
interface QItemVM extends SearchBrief {
  segs: Seg[];
  modLabel: string;
  realLabel: string;
}
interface TopicVM {
  code: string;
  module: string;
  segs: Seg[];
  sub: string;
}
interface PaperVM {
  id: number;
  segs: Seg[];
  sub: string;
}
interface ShenlunVM {
  id: number;
  segs: Seg[];
  sub: string;
}
interface MatVM {
  id: number;
  type: string;
  head: string;
  segs: Seg[];
}

function hl(text: string | null | undefined, q: string): Seg[] {
  const t = String(text || '');
  if (!q) return [{ t, hi: false }];
  const out: Seg[] = [];
  const parts = t.split(q);
  parts.forEach((p, i) => {
    if (p) out.push({ t: p, hi: false });
    if (i < parts.length - 1) out.push({ t: q, hi: true });
  });
  return out.length ? out : [{ t, hi: false }];
}

function modLabel(m: string): string {
  return MODS[m] || modName(m);
}

function readHist(): string[] {
  const h = wx.getStorageSync<string[] | ''>(HIST_KEY);
  return Array.isArray(h) ? h : [];
}

Page({
  data: {
    kw: '',
    tab: 'all',
    tabs: TABS,
    loading: false,
    loadErr: '',
    hasResult: false,
    q: '',
    codeHit: null as QItemVM | null,
    qItems: [] as QItemVM[],
    qTotal: 0,
    hasMore: false,
    moreLoading: false,
    topics: [] as TopicVM[],
    papers: [] as PaperVM[],
    shenlun: [] as ShenlunVM[],
    mats: [] as MatVM[],
    isEmpty: false,
    detailId: 0,
    detailWant: 0,
    detail: null as SearchDetail | null,
    hist: [] as string[],
  },
  _seq: 0,
  _timer: 0 as number | ReturnType<typeof setTimeout>,
  _result: null as SearchResp | null,
  _urlQid: 0,

  onLoad(query: Record<string, string>) {
    this.setData({ hist: readHist() });
    const q = decodeURIComponent(query.q || '').trim();
    if (!q) return;
    if (query.tab && TABS.some((t) => t.value === query.tab)) this.setData({ tab: query.tab });
    if (/^\d+$/.test(query.qid || '')) this._urlQid = Number(query.qid);
    this.setData({ kw: q.slice(0, 64) });
    this.doSearch();
  },
  onUnload() {
    clearTimeout(this._timer);
  },

  showSec(k: string): boolean {
    return this.data.tab === 'all' || this.data.tab === k;
  },

  onInput(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ kw: e.detail.value });
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.doSearch(), 400);
  },
  onSubmit() {
    clearTimeout(this._timer);
    this.doSearch();
  },
  onClear() {
    clearTimeout(this._timer);
    this._result = null;
    this.setData({ kw: '', hasResult: false, loadErr: '', loading: false });
  },
  onCancel() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/home' }) });
  },
  onTab(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ tab: e.detail.value });
    this.doSearch();
  },
  onHist(e: WechatMiniprogram.TouchEvent) {
    const h = String((e.currentTarget.dataset as { h: string }).h || '');
    this.setData({ kw: h });
    this.doSearch();
  },
  onClearHist() {
    wx.removeStorageSync(HIST_KEY);
    this.setData({ hist: [] });
  },
  saveHist(q: string) {
    const h = readHist().filter((x) => x !== q);
    h.unshift(q);
    const hist = h.slice(0, 10);
    wx.setStorageSync(HIST_KEY, hist);
    this.setData({ hist });
  },

  async doSearch() {
    const q = this.data.kw.trim();
    const seq = ++this._seq;
    if (!q) {
      this._result = null;
      this.setData({ hasResult: false, loadErr: '', loading: false });
      return;
    }
    this.setData({ loading: true, detail: null, detailId: 0, detailWant: 0 });
    try {
      const d = await search(q, this.data.tab);
      if (seq !== this._seq) return;
      this._result = d;
      this.render(d);
      this.setData({ loadErr: '' });
      this.saveHist(q);
      if (this._urlQid) {
        const qid = this._urlQid;
        this._urlQid = 0;
        const hit =
          (d.code_hit && d.code_hit.id === qid ? d.code_hit : null) ||
          (d.questions ? d.questions.items.find((x) => x.id === qid) : null);
        if (hit) this.toggleDetail(hit.id);
      }
    } catch (e) {
      if (seq !== this._seq) return;
      const msg = (e as Error).message || '搜索失败';
      if (this._result) wx.showToast({ title: msg, icon: 'none' });
      else this.setData({ loadErr: msg });
    }
    if (seq === this._seq) this.setData({ loading: false });
  },

  render(d: SearchResp) {
    const q = d.q || '';
    const toQ = (it: SearchBrief): QItemVM => ({
      ...it,
      segs: hl(it.question, q),
      modLabel: modLabel(it.module) + (it.submodule ? ' · ' + it.submodule : ''),
      realLabel: it.is_real ? '真题' + (it.exam_year ? ' ' + it.exam_year : '') : '',
    });
    const topics = this.showSec('topic')
      ? (d.topics || []).map((t) => ({
          code: t.code,
          module: t.module,
          segs: hl(t.name, q),
          sub: t.module_name + ' · ' + t.group_name + (t.n ? ' · ' + t.n + ' 题' : ''),
        }))
      : [];
    const papers = this.showSec('paper')
      ? (d.papers || []).map((p) => ({
          id: p.id,
          segs: hl(p.title, q),
          sub: (p.year || '') + (p.region ? ' · ' + p.region : ''),
        }))
      : [];
    const shenlun = this.showSec('shenlun')
      ? (d.shenlun || []).map((s) => ({
          id: s.id,
          segs: hl(s.question, q),
          sub: (s.exam_year || '') + (s.exam_region ? ' · ' + s.exam_region : '') + (s.qtype ? ' · ' + s.qtype : ''),
        }))
      : [];
    const mats = this.showSec('shenlun')
      ? (d.shenlun_mats || []).map((m) => ({
          id: m.id,
          type: m.type || '',
          head: m.topic + (m.type ? ' · ' + m.type : ''),
          segs: hl(m.content, q),
        }))
      : [];
    const qItems = this.showSec('question') && d.questions ? d.questions.items.map(toQ) : [];
    const qTotal = d.questions ? d.questions.total : 0;
    const any =
      !!d.code_hit ||
      qItems.length > 0 ||
      (d.topics || []).length > 0 ||
      (d.papers || []).length > 0 ||
      (d.shenlun || []).length > 0 ||
      (d.shenlun_mats || []).length > 0;
    this.setData({
      hasResult: true,
      q,
      codeHit: d.code_hit ? toQ(d.code_hit) : null,
      qItems,
      qTotal,
      hasMore: !!d.questions && qTotal > d.questions.items.length,
      topics,
      papers,
      shenlun,
      mats,
      isEmpty: !any,
    });
  },

  async onLoadMore() {
    const r = this._result;
    if (!r || !r.questions || this.data.moreLoading) return;
    this.setData({ moreLoading: true });
    try {
      const d = await search(r.q, 'question', r.questions.items.length);
      if (r !== this._result) return;
      if (d.questions) {
        const seen = new Set(r.questions.items.map((x) => x.id));
        r.questions.items.push(...d.questions.items.filter((x) => !seen.has(x.id)));
        this.render(r);
      }
    } catch {
      if (r === this._result) wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      if (r === this._result) this.setData({ moreLoading: false });
    }
  },

  onToggle(e: WechatMiniprogram.TouchEvent) {
    const id = Number((e.currentTarget.dataset as { id: number }).id);
    if (id) this.toggleDetail(id);
  },
  async toggleDetail(id: number) {
    if (this.data.detail && this.data.detailId === id) {
      this.setData({ detail: null, detailId: 0, detailWant: 0 });
      return;
    }
    if (this.data.detailWant === id) return;
    this.setData({ detailWant: id });
    try {
      const d = await searchQuestion(id);
      if (this.data.detailWant !== id) return;
      this.setData({ detail: d, detailId: id });
    } catch {
      if (this.data.detailWant !== id) return;
      this.setData({ detailWant: 0 });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },
  onAsk() {
    const d = this.data.detail;
    if (!d) return;
    const text = askPrefill(d.question, d.options);
    if (!text) return;
    trackEvent('search_ask_click', d.module || '');
    openExplain({ text, qid: d.id, answer: '', qtype: d.submodule || null });
  },
  onCopyLink() {
    const d = this.data.detail;
    if (!d) return;
    // H5 复制的是站点深链；小程序内复制题号语义码，考友在搜索框粘贴即可直达
    wx.setClipboardData({
      data: d.code,
      success: () => wx.showToast({ title: '题号已复制，考友搜索即可直达本题', icon: 'none' }),
    });
  },
  onTopic(e: WechatMiniprogram.TouchEvent) {
    const { code, module } = e.currentTarget.dataset as { code: string; module: string };
    // 对齐 H5 goTopic：practicePreset {module,count:10,adaptive,tag3,source:'search'}
    wx.navigateTo({
      url:
        '/pages/practice/practice?module=' +
        encodeURIComponent(module) +
        '&count=10&adaptive=1&source=search' +
        (code ? '&tag3=' + encodeURIComponent(code) : ''),
    });
  },
  onPaper() {
    // 小程序模考页（pages/exam）尚不接受 paper_id 直达（Exam 组范围）；先切到模考列表
    wx.switchTab({ url: '/pages/exam/exam' });
  },
  onShenlun() {
    wx.showToast({ title: '申论页面小程序端尚未上线', icon: 'none' });
  },
});
