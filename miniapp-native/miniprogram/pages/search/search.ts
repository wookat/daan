import { fetchSearchQuestion, search } from '../../api/index';
import type { SearchQuestionDetail, SearchQuestionHit, SearchResp } from '../../api/types';
import { modName } from '../../utils/stats';

interface HitView extends SearchQuestionHit {
  moduleName: string;
}

interface DetailView extends SearchQuestionDetail {
  optKeys: string[];
}

const HIST_KEY = 'searchHistory';

function loadHistory(): string[] {
  const h = wx.getStorageSync<string[]>(HIST_KEY);
  return Array.isArray(h) ? h : [];
}

Page({
  data: {
    q: '',
    loading: false,
    searched: false,
    err: '',
    history: [] as string[],
    codeHit: null as HitView | null,
    topics: [] as NonNullable<SearchResp['topics']>,
    papers: [] as NonNullable<SearchResp['papers']>,
    questions: [] as HitView[],
    total: 0,
    detail: null as DetailView | null,
    detailLoading: false,
  },
  _timer: 0 as number | ReturnType<typeof setTimeout>,

  onLoad() {
    this.setData({ history: loadHistory() });
  },

  onInput(e: WechatMiniprogram.Input) {
    const q = e.detail.value;
    this.setData({ q });
    if (this._timer) clearTimeout(this._timer);
    if (!q.trim()) {
      this.setData({ searched: false, codeHit: null, topics: [], papers: [], questions: [] });
      return;
    }
    this._timer = setTimeout(() => this.doSearch(q.trim()), 400);
  },
  onConfirm() {
    const q = this.data.q.trim();
    if (q) this.doSearch(q);
  },
  onHistoryTap(e: WechatMiniprogram.TouchEvent) {
    const q = String(e.currentTarget.dataset.q || '');
    this.setData({ q });
    this.doSearch(q);
  },
  onClearHistory() {
    wx.removeStorageSync(HIST_KEY);
    this.setData({ history: [] });
  },

  async doSearch(q: string) {
    this.setData({ loading: true, err: '', searched: true });
    try {
      const d = await search(q);
      const mapHit = (h: SearchQuestionHit): HitView => ({
        ...h,
        moduleName: modName(h.module || ''),
      });
      this.setData({
        loading: false,
        codeHit: d.code_hit ? mapHit(d.code_hit) : null,
        topics: d.topics || [],
        papers: d.papers || [],
        questions: (d.questions ? d.questions.items : []).map(mapHit),
        total: d.questions ? d.questions.total : 0,
      });
      const hist = [q, ...loadHistory().filter((x) => x !== q)].slice(0, 10);
      wx.setStorageSync(HIST_KEY, hist);
      this.setData({ history: hist });
    } catch (e) {
      this.setData({ loading: false, err: (e as Error).message });
    }
  },

  async onQuestion(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id || this.data.detailLoading) return;
    this.setData({ detailLoading: true });
    try {
      const d = await fetchSearchQuestion(id);
      this.setData({
        detail: { ...d, optKeys: Object.keys(d.options || {}).sort() },
        detailLoading: false,
      });
    } catch (e) {
      this.setData({ detailLoading: false });
      wx.showToast({ title: (e as Error).message, icon: 'none' });
    }
  },
  onCloseDetail() {
    this.setData({ detail: null });
  },
  noop() {
    /* 阻止冒泡 */
  },

  onTopic(e: WechatMiniprogram.TouchEvent) {
    const code = String(e.currentTarget.dataset.code || '');
    if (!code) return;
    wx.navigateTo({
      url: '/pages/practice/practice?count=10&source=search&tag3=' + encodeURIComponent(code),
    });
  },
  onPaper(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    if (id) wx.navigateTo({ url: '/pages/exam-run/exam-run?paper_id=' + id });
  },
});
