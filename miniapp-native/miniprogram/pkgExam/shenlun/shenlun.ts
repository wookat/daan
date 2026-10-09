// 申论专区：对照 H5 pkgA/shenlun/shenlun.vue（真题题库/素材范文/作答记录三 tab、详情作答+草稿+AI 批改+历史、收藏本地+服务端同步、深链）
import {
  delShenlunNote,
  fetchShenlunDraft,
  fetchShenlunFilters,
  fetchShenlunHistory,
  fetchShenlunMatFavs,
  fetchShenlunMaterials,
  fetchShenlunNotes,
  fetchShenlunQFavs,
  fetchShenlunQuestion,
  fetchShenlunQuestions,
  saveShenlunDraft,
  saveShenlunNote,
  setShenlunMatFav,
  setShenlunQFav,
  shenlunGrade,
} from '../../api/exam';
import type { ShenlunHistoryItem, ShenlunHotspot, ShenlunMaterial, ShenlunNote, ShenlunQuestion, ShenlunQuestionDetail } from '../../api/exam-types';
import * as hotsMod from './shenlun-hots';
import type { HotVM } from './shenlun-hots';
import {
  MFAV_IDS_KEY,
  MFAV_SNAPS_KEY,
  MTYPES,
  QFAV_IDS_KEY,
  QFAV_SNAPS_KEY,
  QTYPES,
  adoptServerDraft,
  draftKey,
  fmtTime,
  mergeQFavSync,
  missingSnapIds,
  parseWordLimit,
  qMeta,
  qNavState,
  readIds,
  readSnaps,
  toQFavSnap,
  toggleQFav,
  wordState,
  type QNav,
  type WordLimit,
} from '../../utils/kg-shenlun';

const PAGE = 20;
const TABS = [
  { label: '真题题库', value: 'q' },
  { label: '素材/范文', value: 'm' },
  { label: '作答记录', value: 'r' },
];

interface QVM extends ShenlunQuestion {
  faved: boolean;
  meta: string;
  sub: string;
}

interface MVM extends ShenlunMaterial {
  faved: boolean;
  hit: boolean;
  expanded: boolean;
}

interface NoteVM extends ShenlunNote {
  timeText: string;
}

interface RVM extends ShenlunHistoryItem {
  timeText: string;
  body: string;
  expanded: boolean;
}

interface HistVM extends ShenlunHistoryItem {
  timeText: string;
}

Page({
  data: {
    scrollTop: 0,
    tab: 'q',
    tabOpts: TABS,
    // 题库
    qtype: '全部',
    qtypeChips: QTYPES.map((t) => ({ value: t, label: t === '全部' ? '全部题型' : t })),
    year: 0,
    region: '',
    paper: '',
    years: [] as number[],
    yearChips: [] as Array<{ value: number; label: string }>,
    regions: [] as string[],
    regionChips: [] as Array<{ value: string; label: string }>,
    fltOpen: false,
    fltActive: false,
    qs: [] as QVM[],
    qTotal: 0,
    qEnd: false,
    qFavOnly: false,
    qFavCount: 0,
    loading: false,
    qErr: '',
    // 详情
    detail: null as ShenlunQuestionDetail | null,
    detailSub: '',
    detailFaved: false,
    showMat: true,
    showRef: false,
    qNav: { idx: -1, total: 0, prevId: 0, nextId: 0 } as QNav,
    myAnswer: '',
    wordLim: null as WordLimit | null,
    wordSt: '' as '' | 'near' | 'over',
    wordText: '',
    grading: false,
    gradeResult: '',
    gradeErr: '',
    history: [] as HistVM[],
    showHist: false,
    // 素材
    mtype: '全部',
    mtypeChips: MTYPES.map((t) => ({ value: t, label: t })),
    mats: [] as MVM[],
    mEnd: false,
    favOnly: false,
    mFavCount: 0,
    mErr: '',
    // 热点三段式
    hots: [] as HotVM[],
    hotEnd: false,
    // 我的笔记
    notes: [] as NoteVM[],
    noteForm: { open: false, id: 0, topic: '', title: '', content: '' },
    // 记录
    recs: [] as RVM[],
    recLoading: false,
    rErr: '',
  },
  _qOffset: 0,
  _mOffset: 0,
  _qFavIds: [] as number[],
  _qFavs: [] as ShenlunQuestion[],
  _mFavIds: [] as number[],
  _mFavs: [] as ShenlunMaterial[],
  _favSynced: false,
  _pinMid: 0,
  _hitMid: 0,
  _expanded: '' as string | number,
  _draftTimer: 0 as ReturnType<typeof setTimeout> | 0,
  _matsRaw: [] as ShenlunMaterial[],
  _qsRaw: [] as ShenlunQuestion[],
  _hotsRaw: [] as ShenlunHotspot[],
  _hOffset: 0,

  onLoad(opts: Record<string, string>) {
    this._qFavIds = readIds(QFAV_IDS_KEY);
    this._qFavs = readSnaps<ShenlunQuestion>(QFAV_SNAPS_KEY);
    this._mFavIds = readIds(MFAV_IDS_KEY);
    this._mFavs = readSnaps<ShenlunMaterial>(MFAV_SNAPS_KEY);
    this.setData({ qFavCount: this._qFavIds.length, mFavCount: this._mFavIds.length });
    const o = opts || {};
    let paper = '';
    try {
      paper = typeof o.paper === 'string' ? decodeURIComponent(o.paper) : '';
    } catch (e) {
      paper = '';
    }
    if (paper && paper.length <= 100) this.setData({ paper, fltActive: true });
    this.loadQs();
    this.loadFilters().then(() => {
      const y = Number(o.year || '');
      if (this.data.years.includes(y)) this.setYear(y);
      let region = '';
      try {
        region = o.region ? decodeURIComponent(o.region) : '';
      } catch (e) {
        region = '';
      }
      if (region && this.data.regions.includes(region)) this.setRegion(region);
    });
    if (o.tab === 'r') this.switchRec();
    else if (o.tab === 'm') {
      if (MTYPES.includes(o.mtype || '')) this.setData({ mtype: o.mtype });
      if (/^\d+$/.test(o.mid || '')) this._pinMid = Number(o.mid);
      else if (o.fav === '1') this.setData({ favOnly: true });
      this.switchMat();
    }
    if (QTYPES.includes(o.qtype || '')) this.setQtype(o.qtype);
    if ((!o.tab || o.tab === 'q') && o.fav === '1') this.enterQFavView();
    if (/^\d+$/.test(o.id || '')) this.openQ(Number(o.id));
    this.syncQFavs();
  },
  onUnload() {
    if (this._draftTimer) clearTimeout(this._draftTimer);
  },
  onShareAppMessage(): { title: string; path: string } {
    const d = this.data.detail;
    if (d) return { title: '申论真题：' + (d.paper || d.qtype || '') + ' · 来作答并 AI 批改', path: '/pkgExam/shenlun/shenlun?id=' + d.id };
    return { title: '申论专区 · 真题作答 + AI 批改 + 素材范文', path: '/pkgExam/shenlun/shenlun?tab=' + this.data.tab };
  },

  // ---------- 派生 ----------
  qvm(q: ShenlunQuestion): QVM {
    return {
      ...q,
      faved: this._qFavIds.includes(q.id),
      meta: qMeta(q.question),
      sub: q.paper || (q.exam_year || '') + ' · ' + (q.exam_region || ''),
    };
  },
  mvm(m: ShenlunMaterial): MVM {
    return { ...m, faved: this._mFavIds.includes(m.id), hit: m.id === this._hitMid, expanded: this._expanded === m.id };
  },
  renderQs(list: ShenlunQuestion[]) {
    const qs = list.map((q) => this.qvm(q));
    const d = this.data.detail;
    this.setData({
      qs,
      qFavCount: this._qFavIds.length,
      qNav: qNavState(qs.map((q) => q.id), d ? d.id : 0),
      detailFaved: !!d && this._qFavIds.includes(d.id),
    });
  },
  shownQs(): ShenlunQuestion[] {
    return this.data.qFavOnly ? this._qFavs : this.data.qs;
  },
  renderMats(list: ShenlunMaterial[]) {
    this.setData({ mats: list.map((m) => this.mvm(m)), mFavCount: this._mFavIds.length });
  },
  shownMats(): ShenlunMaterial[] {
    return this.data.favOnly ? this._mFavs : this._matsRaw;
  },
  updateFltActive() {
    const d = this.data;
    this.setData({ fltActive: !!(d.year || d.region || d.paper || d.qtype !== '全部' || d.qFavOnly) });
  },

  // ---------- 题库 ----------
  async loadQs(append = false) {
    this.setData({ loading: !append, qErr: '' });
    try {
      const d = await fetchShenlunQuestions({
        qtype: this.data.qtype,
        year: this.data.year,
        region: this.data.region,
        paper: this.data.paper,
        offset: this._qOffset,
        limit: PAGE,
      });
      const items = d.items || [];
      this._qsRaw = append ? this._qsRaw.concat(items) : items;
      this.setData({ qEnd: items.length < PAGE, qTotal: d.total || items.length });
      if (!this.data.qFavOnly) this.renderQs(this._qsRaw);
    } catch (e) {
      const msg = (e as Error).message || '网络异常';
      this.setData({ qErr: msg });
      wx.showToast({ title: '加载失败：' + msg, icon: 'none' });
    }
    this.setData({ loading: false });
  },
  loadMore() {
    this._qOffset += PAGE;
    this.loadQs(true);
  },
  async loadFilters() {
    try {
      const d = await fetchShenlunFilters();
      const years = d.years || [];
      const regions = d.regions || [];
      this.setData({
        years,
        regions,
        yearChips: [{ value: 0, label: '全部' }].concat(years.map((y) => ({ value: y, label: String(y) }))),
        regionChips: [{ value: '', label: '全部' }].concat(regions.map((r) => ({ value: r, label: r }))),
      });
    } catch (e) {
      /* 筛选项加载失败不阻断列表 */
    }
  },
  resetQList() {
    this._qOffset = 0;
    this.setData({ qEnd: false, qFavOnly: false, detail: null });
    this.updateFltActive();
    this.loadQs();
  },
  setYear(y: number) {
    this.setData({ year: y });
    this.resetQList();
  },
  setRegion(r: string) {
    this.setData({ region: r });
    this.resetQList();
  },
  setQtype(t: string) {
    this.setData({ qtype: t });
    this.resetQList();
  },
  onQtype(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setQtype(e.detail.value);
  },
  onYear(e: WechatMiniprogram.CustomEvent<{ value: number }>) {
    this.setYear(e.detail.value);
  },
  onRegion(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setRegion(e.detail.value);
  },
  onPaperTap(e: WechatMiniprogram.TouchEvent) {
    this.applyPaper(String(e.currentTarget.dataset.paper || ''));
  },
  clearPaper() {
    this.applyPaper('');
  },
  applyPaper(p: string) {
    const next = p.length <= 100 ? p : '';
    if (next === this.data.paper) return;
    this.setData({ paper: next });
    this.resetQList();
  },
  clearFlt() {
    this.setData({ qtype: '全部', year: 0, region: '', paper: '', fltOpen: false });
    this.resetQList();
  },
  openFlt() {
    this.setData({ fltOpen: true });
  },
  closeFlt() {
    this.setData({ fltOpen: false });
  },
  toggleQFavOnly() {
    if (this.data.qFavOnly) {
      this.setData({ qFavOnly: false });
      this.renderQs(this._qsRaw);
      this.updateFltActive();
    } else this.enterQFavView();
  },
  enterQFavView() {
    this.setData({ qFavOnly: true, detail: null });
    this.renderQs(this._qFavs);
    this.updateFltActive();
    for (const id of missingSnapIds(this._qFavIds, this._qFavs).slice(0, 20)) {
      fetchShenlunQuestion(id)
        .then((d) => {
          const it = d && d.item;
          if (it && !this._qFavs.some((x) => x && x.id === it.id)) {
            this._qFavs = this._qFavs.concat([toQFavSnap(it)]);
            wx.setStorageSync(QFAV_SNAPS_KEY, this._qFavs);
            if (this.data.qFavOnly) this.renderQs(this._qFavs);
          }
        })
        .catch(() => {});
    }
  },
  persistQFavs() {
    wx.setStorageSync(QFAV_IDS_KEY, this._qFavIds);
    wx.setStorageSync(QFAV_SNAPS_KEY, this._qFavs);
  },
  toggleQFavBy(q: ShenlunQuestion) {
    const r = toggleQFav({ ids: this._qFavIds, snaps: this._qFavs }, q);
    this._qFavIds = r.ids;
    this._qFavs = r.snaps;
    this.persistQFavs();
    setShenlunQFav(q.id, r.added).catch(() => {});
    this.renderQs(this.shownQs());
  },
  onQFav(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    const q = this.shownQs().find((x) => x.id === id);
    if (q) this.toggleQFavBy(q);
  },
  onDetailFav() {
    if (this.data.detail) this.toggleQFavBy(this.data.detail);
  },
  async syncQFavs() {
    try {
      const d = await fetchShenlunQFavs();
      const r = mergeQFavSync({ ids: this._qFavIds, snaps: this._qFavs }, d);
      for (const id of r.pushIds) setShenlunQFav(id, true).catch(() => {});
      this._qFavIds = r.ids;
      this._qFavs = r.snaps;
      this.persistQFavs();
      this.renderQs(this.shownQs());
    } catch (e) {
      /* 非关键路径 */
    }
  },

  // ---------- 详情 ----------
  onOpenQ(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    if (id) this.openQ(id);
  },
  onPrevQ() {
    if (this.data.qNav.prevId) this.openQ(this.data.qNav.prevId);
  },
  onNextQ() {
    if (this.data.qNav.nextId) this.openQ(this.data.qNav.nextId);
  },
  async openQ(id: number) {
    try {
      const d = await fetchShenlunQuestion(id);
      const detail = d.item;
      const myAnswer = String(wx.getStorageSync(draftKey(id)) || '');
      const wordLim = parseWordLimit(detail.question);
      this.setData({
        tab: 'q',
        detail,
        detailSub: detail.paper || (detail.exam_year || '') + ' · ' + (detail.exam_region || ''),
        detailFaved: this._qFavIds.includes(detail.id),
        showMat: true,
        showRef: false,
        myAnswer,
        wordLim,
        gradeResult: '',
        gradeErr: '',
        history: [],
        showHist: false,
        qNav: qNavState(this.shownQs().map((q) => q.id), detail.id),
      });
      this.updateWordText();
      this.syncDraft(id);
      this.loadHistory(id);
      this.scrollToTop();
    } catch (e) {
      wx.showToast({ title: '加载失败：' + (e as Error).message, icon: 'none' });
    }
  },
  backToList() {
    this.setData({ detail: null });
  },
  /** 页面主体是 scroll-view，wx.pageScrollTo 不作用于它；scroll-top 同值不触发，先置 1 再归 0 */
  scrollToTop() {
    this.setData({ scrollTop: 1 }, () => this.setData({ scrollTop: 0 }));
  },
  toggleMat() {
    this.setData({ showMat: !this.data.showMat });
  },
  toggleRef() {
    this.setData({ showRef: !this.data.showRef });
  },
  toggleHist() {
    this.setData({ showHist: !this.data.showHist });
  },
  copyQLink() {
    const d = this.data.detail;
    if (!d) return;
    wx.setClipboardData({
      data: 'https://kaogong.zalize.com/#/pkgA/shenlun/shenlun?id=' + d.id,
      success: () => wx.showToast({ title: '链接已复制，发给考友直达本题', icon: 'none' }),
    });
  },
  updateWordText() {
    const { myAnswer, wordLim } = this.data;
    const st = wordState(myAnswer.length, wordLim);
    let text = '';
    if (wordLim) {
      text = myAnswer
        ? myAnswer.length + ' / 限' + wordLim.label + (st === 'over' ? '，已超 ' + (myAnswer.length - wordLim.max) + ' 字' : '')
        : '限' + wordLim.label;
    } else if (myAnswer) text = '已自动保存 · ' + myAnswer.length + ' 字';
    this.setData({ wordSt: st, wordText: text });
  },
  onAnswerInput(e: WechatMiniprogram.TextareaInput) {
    this.setData({ myAnswer: e.detail.value });
    this.updateWordText();
    this.saveDraft();
  },
  saveDraft() {
    const d = this.data.detail;
    if (!d) return;
    const k = draftKey(d.id);
    if (this.data.myAnswer) wx.setStorageSync(k, this.data.myAnswer);
    else wx.removeStorageSync(k);
    const qid = d.id;
    if (this._draftTimer) clearTimeout(this._draftTimer);
    this._draftTimer = setTimeout(() => this.pushDraft(qid), 1500);
  },
  pushDraft(qid: number, content?: string) {
    const d = this.data.detail;
    const c = content !== undefined ? content : d && d.id === qid ? this.data.myAnswer : String(wx.getStorageSync(draftKey(qid)) || '');
    saveShenlunDraft(qid, c).catch(() => {});
  },
  async syncDraft(id: number) {
    try {
      const d = await fetchShenlunDraft(id);
      const cur = this.data.detail;
      if (!cur || cur.id !== id) return;
      const adopted = adoptServerDraft(this.data.myAnswer, d);
      if (adopted !== null) {
        this.setData({ myAnswer: adopted });
        wx.setStorageSync(draftKey(id), adopted);
        this.updateWordText();
      }
    } catch (e) {
      /* 非关键路径 */
    }
  },
  async loadHistory(id: number) {
    try {
      const d = await fetchShenlunHistory(id);
      const cur = this.data.detail;
      if (cur && cur.id === id) this.setData({ history: (d.items || []).map((h) => ({ ...h, timeText: fmtTime(h.created_at) })) });
    } catch (e) {
      /* 历史加载失败不阻断 */
    }
  },
  async grade() {
    const d = this.data.detail;
    if (!d || this.data.grading || !this.data.myAnswer.trim()) return;
    this.setData({ grading: true, gradeResult: '', gradeErr: '' });
    try {
      const r = await shenlunGrade(d.id, this.data.myAnswer);
      this.setData({ gradeResult: r.result });
      this.loadHistory(d.id);
      wx.removeStorageSync(draftKey(d.id));
      if (this._draftTimer) clearTimeout(this._draftTimer);
      this.pushDraft(d.id, '');
    } catch (e) {
      const msg = (e as Error).message || '批改失败，请稍后重试';
      // 访问码取消 / 后端 AI 未配置（502 批改失败：AI 服务未配置）等：作答保留为草稿，页面内显示降级文案
      this.saveDraft();
      this.setData({ gradeErr: msg.includes('已取消') ? '已取消，作答内容已保留为草稿' : msg + '。作答已保留为草稿，可稍后重试或先对照参考要点自评' });
    }
    this.setData({ grading: false });
  },

  // ---------- 素材 ----------
  async loadMats(append = false) {
    if (this.data.mtype === '热点') return this.loadHots(append);
    if (this.data.mtype === '我的笔记') return this.loadNotes();
    this.setData({ loading: !append, mErr: '' });
    try {
      const d = await fetchShenlunMaterials({ type: this.data.mtype, offset: this._mOffset, limit: PAGE });
      const items = d.items || [];
      this._matsRaw = append ? this._matsRaw.concat(items) : items;
      this.setData({ mEnd: items.length < PAGE });
      if (!append && this._pinMid) {
        const midv = this._pinMid;
        this._pinMid = 0;
        let hit = this._matsRaw.find((m) => m.id === midv);
        if (!hit) {
          try {
            const r = await fetchShenlunMaterials({ id: midv });
            hit = (r.items || [])[0];
          } catch (e2) {
            /* 深链命中拉取失败不阻断列表 */
          }
        }
        if (hit) {
          this._matsRaw = [hit].concat(this._matsRaw.filter((m) => m.id !== midv));
          this._hitMid = midv;
          this._expanded = midv;
        }
      }
      if (!this.data.favOnly) this.renderMats(this._matsRaw);
    } catch (e) {
      const msg = (e as Error).message || '网络异常';
      this.setData({ mErr: msg });
      wx.showToast({ title: '加载失败：' + msg, icon: 'none' });
    }
    this.setData({ loading: false });
  },
  loadMoreMat() {
    if (this.data.mtype === '热点') {
      this._hOffset += PAGE;
      return this.loadHots(true);
    }
    if (this.data.mtype === '我的笔记') return;
    this._mOffset += PAGE;
    this.loadMats(true);
  },
  onMtype(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setMtype(e.detail.value);
  },
  setMtype(t: string) {
    this._mOffset = 0;
    this._hOffset = 0;
    this.setData({ favOnly: false, mtype: t, mEnd: false, hotEnd: false });
    this.loadMats();
  },

  // ---------- 热点三段式（实现见 shenlun-hots.ts，p 委托） ----------
  hotvm(g: ShenlunHotspot): HotVM {
    return hotsMod.hotvm(this, g);
  },
  renderHots() {
    hotsMod.renderHots(this);
  },
  async loadHots(append = false) {
    return hotsMod.loadHots(this, append);
  },
  onHotExpand(e: WechatMiniprogram.TouchEvent) {
    hotsMod.onHotExpand(this, e);
  },
  toggleHotOthers(e: WechatMiniprogram.TouchEvent) {
    hotsMod.toggleHotOthers(this, e);
  },
  onHotFav(e: WechatMiniprogram.TouchEvent) {
    hotsMod.onHotFav(this, e);
  },

  // ---------- 我的笔记 ----------
  async loadNotes() {
    this.setData({ loading: true, mErr: '' });
    try {
      const d = await fetchShenlunNotes();
      this.setData({
        notes: (d.items || []).map((n) => ({ ...n, timeText: fmtTime(n.updated_at || n.created_at) })),
      });
    } catch (e) {
      const msg = (e as Error).message || '网络异常';
      this.setData({ mErr: msg });
      wx.showToast({ title: '加载失败：' + msg, icon: 'none' });
    }
    this.setData({ loading: false });
  },
  onNoteAdd() {
    this.setData({ noteForm: { open: true, id: 0, topic: '', title: '', content: '' } });
  },
  onNoteEdit(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    const n = this.data.notes.find((x) => x.id === id);
    if (!n) return;
    this.setData({
      noteForm: { open: true, id: n.id, topic: n.topic || '', title: n.title || '', content: n.content },
    });
  },
  onNoteClose() {
    this.setData({ 'noteForm.open': false });
  },
  onNoteField(e: WechatMiniprogram.CustomEvent) {
    const k = String(e.currentTarget.dataset.k || '');
    if (k) this.setData({ ['noteForm.' + k]: e.detail.value } as never);
  },
  async onNoteSave() {
    const f = this.data.noteForm;
    if (!f.content.trim()) {
      wx.showToast({ title: '笔记内容为空', icon: 'none' });
      return;
    }
    try {
      await saveShenlunNote({ id: f.id || undefined, topic: f.topic, title: f.title, content: f.content });
      this.setData({ 'noteForm.open': false });
      this.loadNotes();
    } catch (e) {
      wx.showToast({ title: (e as Error).message || '保存失败', icon: 'none' });
    }
  },
  onNoteDel(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    wx.showModal({
      title: '删除笔记',
      content: '确定删除这条笔记吗？',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await delShenlunNote(id);
          this.loadNotes();
        } catch (e2) {
          wx.showToast({ title: (e2 as Error).message || '删除失败', icon: 'none' });
        }
      },
    });
  },
  resetMtype() {
    this.setMtype('全部');
  },
  toggleFavOnly() {
    const favOnly = !this.data.favOnly;
    this.setData({ favOnly });
    this.renderMats(favOnly ? this._mFavs : this._matsRaw);
  },
  onMatExpand(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    this._expanded = this._expanded === id ? 0 : id;
    this.renderMats(this.shownMats());
  },
  onMatFav(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    const m = this.shownMats().find((x) => x.id === id);
    if (!m) return;
    const i = this._mFavIds.indexOf(m.id);
    const on = i < 0;
    if (on) {
      this._mFavIds.push(m.id);
      this._mFavs.unshift(m);
    } else {
      this._mFavIds.splice(i, 1);
      this._mFavs = this._mFavs.filter((x) => x.id !== m.id);
    }
    wx.setStorageSync(MFAV_IDS_KEY, this._mFavIds);
    wx.setStorageSync(MFAV_SNAPS_KEY, this._mFavs);
    setShenlunMatFav(m.id, on).catch(() => {});
    this.renderMats(this.shownMats());
  },
  async syncFavs() {
    try {
      const d = await fetchShenlunMatFavs();
      const serverIds = d.ids || [];
      const localOnly = this._mFavIds.filter((id) => !serverIds.includes(id));
      for (const id of localOnly) setShenlunMatFav(id, true).catch(() => {});
      const merged = (d.items || []).filter((x) => !localOnly.includes(x.id));
      this._mFavs = [...this._mFavs.filter((x) => localOnly.includes(x.id)), ...merged];
      this._mFavIds = this._mFavs.map((x) => x.id);
      wx.setStorageSync(MFAV_IDS_KEY, this._mFavIds);
      wx.setStorageSync(MFAV_SNAPS_KEY, this._mFavs);
      this.renderMats(this.shownMats());
    } catch (e) {
      /* 非关键路径 */
    }
  },
  copyMatLink(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    const m = this.shownMats().find((x) => x.id === id);
    if (!m) return;
    wx.setClipboardData({
      data: 'https://kaogong.zalize.com/#/pkgA/shenlun/shenlun?tab=m&mid=' + m.id + (m.type ? '&mtype=' + encodeURIComponent(m.type) : ''),
      success: () => wx.showToast({ title: '链接已复制，发给考友直达本条素材', icon: 'none' }),
    });
  },

  // ---------- 作答记录 ----------
  async switchRec() {
    this.setData({ tab: 'r', rErr: '', recLoading: true });
    try {
      const d = await fetchShenlunHistory(null, 50);
      this.setData({
        recs: (d.items || []).map((r) => ({
          ...r,
          timeText: fmtTime(r.created_at),
          body: '【我的作答】\n' + r.answer + (r.result ? '\n\n【批改结果】\n' + r.result : ''),
          expanded: this._expanded === 'r' + r.id,
        })),
      });
    } catch (e) {
      const msg = (e as Error).message || '网络异常';
      this.setData({ rErr: msg });
      wx.showToast({ title: '加载失败：' + msg, icon: 'none' });
    }
    this.setData({ recLoading: false });
  },
  onRecExpand(e: WechatMiniprogram.TouchEvent) {
    const key = 'r' + Number(e.currentTarget.dataset.id);
    this._expanded = this._expanded === key ? 0 : key;
    this.setData({ recs: this.data.recs.map((r) => ({ ...r, expanded: this._expanded === 'r' + r.id })) });
  },
  onRecOpen(e: WechatMiniprogram.TouchEvent) {
    const qid = Number(e.currentTarget.dataset.qid);
    if (qid) this.openQ(qid);
  },

  // ---------- tab ----------
  onTab(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const v = e.detail.value;
    if (v === this.data.tab) return;
    if (v === 'q') this.setData({ tab: 'q' });
    else if (v === 'm') this.switchMat();
    else this.switchRec();
  },
  tapQ() {
    this.setData({ tab: 'q' });
  },
  switchMat() {
    this.setData({ tab: 'm' });
    if (!this._matsRaw.length) this.loadMats();
    else this.renderMats(this.shownMats());
    if (!this._favSynced) {
      this._favSynced = true;
      this.syncFavs();
    }
  },
});
