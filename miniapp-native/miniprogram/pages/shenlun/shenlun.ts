import {
  fetchAccessInfo,
  fetchShenlunDetail,
  fetchShenlunFilters,
  fetchShenlunHistory,
  fetchShenlunMatFavs,
  fetchShenlunMaterials,
  fetchShenlunQuestions,
  gradeShenlun,
  setShenlunMatFav,
} from '../../api/p3';
import type {
  ShenlunDetail,
  ShenlunHistoryItem,
  ShenlunMaterial,
  ShenlunQuestion,
} from '../../api/p3';
import { getAccessCode } from '../../utils/auth';
import { promptAccessCode } from '../../utils/request';
import { fmtDateTime, mdToPlain, stripStop } from '../../utils/text';

interface MatRow extends ShenlunMaterial {
  fav: boolean;
  open: boolean;
}

interface HistRow extends ShenlunHistoryItem {
  timeText: string;
}

Page({
  data: {
    tab: 'q' as 'q' | 'm' | 'h',
    // 题库
    qLoading: true,
    questions: [] as ShenlunQuestion[],
    qTotal: 0,
    qOffset: 0,
    qtype: '',
    year: 0,
    region: '',
    qtypes: ['概括归纳', '综合分析', '对策建议', '公文写作', '大作文'],
    years: [] as number[],
    regions: [] as string[],
    // 素材
    mLoading: false,
    mLoaded: false,
    materials: [] as MatRow[],
    matType: '',
    matTypes: ['金句', '案例', '范文', '对策'],
    onlyFav: false,
    // 记录
    hLoading: false,
    hLoaded: false,
    history: [] as HistRow[],
    // 详情/作答
    detail: null as ShenlunDetail | null,
    detailLoading: false,
    myAnswer: '',
    grading: false,
    report: '',
    showMaterial: true,
    showReference: false,
  },
  _draftTimer: 0 as number | ReturnType<typeof setTimeout>,
  _matFavIds: [] as number[],

  onLoad() {
    this.loadFilters();
    this.loadQuestions(true);
  },

  onTab(e: WechatMiniprogram.TouchEvent) {
    const tab = e.currentTarget.dataset.tab as 'q' | 'm' | 'h';
    this.setData({ tab });
    if (tab === 'm' && !this.data.mLoaded) this.loadMaterials(true);
    if (tab === 'h' && !this.data.hLoaded) this.loadHistory();
  },

  async loadFilters() {
    try {
      const d = await fetchShenlunFilters();
      this.setData({ years: d.years || [], regions: d.regions || [] });
    } catch (e) {
      /* 非关键路径 */
    }
  },

  async loadQuestions(reset: boolean) {
    const offset = reset ? 0 : this.data.qOffset;
    this.setData({ qLoading: true });
    try {
      const d = await fetchShenlunQuestions({
        qtype: this.data.qtype || undefined,
        year: this.data.year || undefined,
        region: this.data.region || undefined,
        offset,
      });
      const items = reset ? d.items || [] : [...this.data.questions, ...(d.items || [])];
      this.setData({
        qLoading: false,
        questions: items,
        qTotal: d.total || 0,
        qOffset: offset + (d.items || []).length,
      });
    } catch (e) {
      this.setData({ qLoading: false });
      wx.showToast({ title: '加载失败：' + (e as Error).message, icon: 'none' });
    }
  },
  onQtype(e: WechatMiniprogram.TouchEvent) {
    const v = String(e.currentTarget.dataset.v || '');
    this.setData({ qtype: this.data.qtype === v ? '' : v });
    this.loadQuestions(true);
  },
  onYear(e: WechatMiniprogram.TouchEvent) {
    const v = Number(e.currentTarget.dataset.v || 0);
    this.setData({ year: this.data.year === v ? 0 : v });
    this.loadQuestions(true);
  },
  onRegion(e: WechatMiniprogram.TouchEvent) {
    const v = String(e.currentTarget.dataset.v || '');
    this.setData({ region: this.data.region === v ? '' : v });
    this.loadQuestions(true);
  },
  onMoreQuestions() {
    if (!this.data.qLoading && this.data.questions.length < this.data.qTotal) {
      this.loadQuestions(false);
    }
  },

  async loadMaterials(reset: boolean) {
    this.setData({ mLoading: true });
    try {
      if (reset) {
        try {
          const f = await fetchShenlunMatFavs();
          this._matFavIds = f.ids || [];
        } catch (err) {
          /* 收藏拉取失败不阻塞素材列表 */
        }
      }
      const d = await fetchShenlunMaterials(this.data.matType || undefined, reset ? 0 : this.data.materials.length);
      const rows: MatRow[] = (d.items || []).map((m) => ({
        ...m,
        fav: this._matFavIds.includes(m.id),
        open: false,
      }));
      this.setData({
        mLoading: false,
        mLoaded: true,
        materials: reset ? rows : [...this.data.materials, ...rows],
      });
    } catch (e) {
      this.setData({ mLoading: false });
      wx.showToast({ title: '素材加载失败：' + (e as Error).message, icon: 'none' });
    }
  },
  onMatType(e: WechatMiniprogram.TouchEvent) {
    const v = String(e.currentTarget.dataset.v || '');
    this.setData({ matType: this.data.matType === v ? '' : v });
    this.loadMaterials(true);
  },
  onToggleOnlyFav() {
    this.setData({ onlyFav: !this.data.onlyFav });
  },
  onToggleMat(e: WechatMiniprogram.TouchEvent) {
    const i = Number(e.currentTarget.dataset.index);
    this.setData({ [`materials[${i}].open`]: !this.data.materials[i].open });
  },
  async onFavMat(e: WechatMiniprogram.TouchEvent) {
    const i = Number(e.currentTarget.dataset.index);
    const m = this.data.materials[i];
    if (!m) return;
    const on = !m.fav;
    this.setData({ [`materials[${i}].fav`]: on });
    this._matFavIds = on ? [...this._matFavIds, m.id] : this._matFavIds.filter((x) => x !== m.id);
    try {
      await setShenlunMatFav(m.id, on);
      wx.showToast({ title: on ? '已收藏素材' : '已取消收藏', icon: 'none' });
    } catch (err) {
      this.setData({ [`materials[${i}].fav`]: !on });
      wx.showToast({ title: '操作失败：' + (err as Error).message, icon: 'none' });
    }
  },

  async loadHistory() {
    this.setData({ hLoading: true });
    try {
      const d = await fetchShenlunHistory();
      this.setData({
        hLoading: false,
        hLoaded: true,
        history: (d.items || []).map((x) => ({ ...x, timeText: fmtDateTime(x.created_at) })),
      });
    } catch (e) {
      this.setData({ hLoading: false });
      wx.showToast({ title: '记录加载失败：' + (e as Error).message, icon: 'none' });
    }
  },
  onOpenHist(e: WechatMiniprogram.TouchEvent) {
    const i = Number(e.currentTarget.dataset.index);
    const h = this.data.history[i];
    if (!h) return;
    this.openDetail(h.qid, h.answer, h.result || '');
  },

  onOpenQuestion(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    if (id) this.openDetail(id, '', '');
  },
  async openDetail(id: number, presetAnswer: string, presetReport: string) {
    if (this.data.detailLoading) return;
    this.setData({ detailLoading: true });
    try {
      const d = await fetchShenlunDetail(id);
      const draft = presetAnswer || wx.getStorageSync<string>('slDraft:' + id) || '';
      this.setData({
        detailLoading: false,
        detail: d.item,
        myAnswer: draft,
        report: presetReport ? mdToPlain(stripStop(presetReport)) : '',
        showMaterial: true,
        showReference: false,
      });
    } catch (e) {
      this.setData({ detailLoading: false });
      wx.showToast({ title: '题目加载失败：' + (e as Error).message, icon: 'none' });
    }
  },
  onCloseDetail() {
    this.setData({ detail: null, report: '' });
  },
  onToggleMaterial() {
    this.setData({ showMaterial: !this.data.showMaterial });
  },
  onToggleReference() {
    this.setData({ showReference: !this.data.showReference });
  },
  onAnswerInput(e: WechatMiniprogram.Input) {
    const v = e.detail.value;
    this.setData({ myAnswer: v });
    const d = this.data.detail;
    if (!d) return;
    if (this._draftTimer) clearTimeout(this._draftTimer);
    this._draftTimer = setTimeout(() => {
      wx.setStorageSync('slDraft:' + d.id, v);
    }, 800);
  },

  async onGrade() {
    const d = this.data.detail;
    const ans = this.data.myAnswer.trim();
    if (!d || this.data.grading) return;
    if (ans.length < 50) {
      wx.showToast({ title: '至少作答 50 字，AI 才能有效批改', icon: 'none' });
      return;
    }
    if (!getAccessCode()) {
      const info = await fetchAccessInfo();
      if (info && info.required && !(await promptAccessCode())) return;
    }
    this.setData({ grading: true });
    try {
      const r = await gradeShenlun(d.id, ans);
      this.setData({ grading: false, report: mdToPlain(stripStop(r.result || '')) });
      wx.removeStorageSync('slDraft:' + d.id);
    } catch (e) {
      this.setData({ grading: false });
      wx.showToast({ title: '批改失败：' + (e as Error).message, icon: 'none' });
    }
  },
  noop() {
    /* 阻止冒泡 */
  },
});
