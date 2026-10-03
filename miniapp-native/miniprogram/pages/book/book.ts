import {
  createFavFolder,
  deleteFav,
  deleteFavFolder,
  deleteMistake,
  fetchFavFolders,
  fetchFavs,
  fetchMistakes,
  fetchNote,
  fetchQuestions,
  fetchReviewDue,
  patchMistake,
  postManualMistake,
  postQuestionReport,
  postReviewRecord,
  renameFavFolder,
  saveNote,
  shareCreate,
  trackEvent,
} from '../../api/index';
import {
  type AttemptItem,
  fetchAttempts,
  fetchPaperInfo,
  fetchReinforceSuggest,
  fetchReviewCur,
  mistakeAnalysis,
  type PaperAnswersResp,
  type PaperInfo,
  redoMistakesFiltered,
  type ReinforceItem,
  saveReviewCur,
  submitPaperAnswers,
} from '../../api/learn';
import { scanSheet } from '../../api/exam';
import type { FavFolder, FavItem, Mistake } from '../../api/types';
import { anonUid } from '../../utils/auth';
import { emptyManualEntry, letterRow, MANUAL_MODULES, manualEntryBody, manualEntryError, manualSavedToast, toggleLetter } from '../../utils/manual-entry';
import { md } from '../../utils/md';
import { buildReviewSnap, parseReviewSnap, reviewElapsedSecs, REVIEW_SNAP_KEY, type ReviewResume } from '../../utils/review-snap';
import { nextReviewText, reviewVerdict, streakProgressText, similarRoom, reviewDueLeft, reviewDoneCopy } from '../../utils/review-verdict';
import { MODULE_NAMES, modName } from '../../utils/stats';
import { syncTabBar } from '../../utils/tabbar';

interface MRow extends Mistake {
  modName: string;
  typeName: string;
  streakText: string;
  open: boolean;
  optList: { k: string; v: string; ok: boolean; bad: boolean }[];
  attempts?: string[];
}

// 来源站细题型（H5 tagName / 后端 norm_qtype 同口径）：只去「模块名-」前缀（历史数据两种格式并存），
// 「法律-个税」自带的「-」不切；无题型时用模块名
const QTYPE_MOD_PREFIXES = ['资料分析', '数量关系', '言语理解', '判断推理', '常识判断', '常识', '时政'];
function tagName(m: Mistake): string {
  const qt = (m.question_type || '').trim();
  if (!qt) return modName(m.module);
  const i = qt.indexOf('-');
  if (i < 0) return qt;
  const rest = qt.slice(i + 1).trim();
  return QTYPE_MOD_PREFIXES.includes(qt.slice(0, i)) && rest ? rest : qt;
}

// 主题型标签（H5 groupKey）：分类树题型组优先，手录/对不回题库的行回退细题型
function groupName(m: Mistake): string {
  return m.type_group || tagName(m);
}

function fmtTs(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return '今天 ' + hm;
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (sameDay(d, yest)) return '昨天 ' + hm;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function fmtAttempts(items: AttemptItem[]): string[] {
  return items.map(
    (a) =>
      fmtTs(a.created_at) +
      ' · ' +
      (a.source === 'review' ? '复习' : '练习') +
      ' · 选 ' +
      (a.picked || '—') +
      ' · ' +
      (a.correct ? '对' : '错') +
      (a.secs ? ' · ' + a.secs + 's' : '')
  );
}

const LETTERS = ['A', 'B', 'C', 'D'];
interface ManualRow {
  no: number;
  opts: { L: string; on: boolean }[];
}
function buildManualRows(n: number, picks: Record<string, string>): ManualRow[] {
  const rows: ManualRow[] = [];
  for (let no = 1; no <= n; no++) {
    rows.push({ no, opts: LETTERS.map((L) => ({ L, on: picks[String(no)] === L })) });
  }
  return rows;
}
interface ScanRow {
  no: number;
  pickText: string;
  cls: string;
  answer: string;
  mark: string;
}
function buildScanRows(d: PaperAnswersResp): ScanRow[] {
  return (d.items || []).map((r) => ({
    no: r.no,
    pickText: r.status === 'blank' ? '未涂' : r.status === 'multi' ? '多涂 ' + (r.picked || '') : r.picked || '',
    cls: r.correct ? 'good' : r.status === 'ok' && !r.correct ? 'bad' : '',
    answer: r.answer || '—',
    mark: r.correct ? '✓' : r.status === 'ok' ? '✗' : '—',
  }));
}

function reinforceMeta(r: ReinforceItem): string {
  return (
    (r.module_name || modName(r.module)) +
    (r.tag3_name ? ' · ' + r.submodule : '') +
    ' · 掌握度 ' +
    Math.round(r.mastery * 100) +
    '%（' +
    r.level_name +
    '） · 今日错 ' +
    r.wrong_today +
    ' 道'
  );
}

function optList(m: Mistake): MRow['optList'] {
  const o = m.options;
  if (!o) return [];
  const ok = extractLetter(m.correct_answer);
  const bad = extractLetter(m.user_answer);
  return Object.keys(o)
    .sort()
    .filter((k) => (o[k] || '').trim())
    .map((k) => ({ k, v: o[k], ok: ok.includes(k), bad: bad.includes(k) && !ok.includes(k) }));
}

interface RItem extends Mistake {
  requeued?: boolean;
  extra?: boolean;
  simFetched?: boolean;
  appended?: number;
  streak?: number;
  masteredNow?: boolean;
  nextDays?: number;
}

interface RecapRow {
  name: string;
  n: number;
  pct: number;
}

const REASONS = ['粗心大意', '概念不清', '方法不会', '纯蒙的'];

const REPORT_TYPES = ['答案错误', '解析错误', '题干或选项错字', '图片缺失', '分类错误', '重复题', '其他'];

const SORTS = [
  { k: 'time', t: '最新' },
  { k: 'times', t: '错次多' },
  { k: 'type', t: '按题型' },
  { k: 'reason', t: '按错因' },
];

type Opt = { value: string; label: string };
const toOpts = (xs: string[]): Opt[] => xs.map((x) => ({ value: x, label: x }));
// 筛选 chip 行首项「全部」= ''（原点选已选中取消的语义由它承接）
const withAll = (xs: string[]): Opt[] => [{ value: '', label: '全部' }].concat(toOpts(xs));

type ChipChange = WechatMiniprogram.CustomEvent<{ value: string }>;
type VisibleChange = WechatMiniprogram.CustomEvent<{ visible: boolean }>;

function monthRecap(all: Mistake[]): { total: number; byModule: RecapRow[]; byReason: RecapRow[] } {
  const now = new Date();
  const m0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;
  const cur = all.filter((m) => Number(m.created_at || 0) >= m0);
  const agg = (keyf: (m: Mistake) => string): RecapRow[] => {
    const map: Record<string, number> = {};
    for (const m of cur) {
      const k = keyf(m);
      map[k] = (map[k] || 0) + 1;
    }
    return Object.keys(map)
      .map((name) => ({ name, n: map[name], pct: Math.round((map[name] / cur.length) * 100) }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
  };
  return {
    total: cur.length,
    byModule: agg((m) => modName(m.module) || m.module || '其他'),
    byReason: agg((m) => m.error_reason || '未标注'),
  };
}

function extractLetter(s: string | null | undefined): string {
  const m = /[A-D]+/.exec(String(s || '').toUpperCase());
  return m ? Array.from(new Set(m[0])).sort().join('') : '';
}

Page({
  data: {
    tab: 'todo' as 'todo' | 'done' | 'sticky' | 'fav',
    loading: true,
    all: [] as MRow[],
    shown: [] as MRow[],
    favs: [] as FavItem[],
    todoCount: 0,
    doneCount: 0,
    due: [] as Mistake[],
    dueTotal: 0,
    reviewing: false,
    rItems: [] as RItem[],
    rIdx: 0,
    rCur: null as RItem | null,
    rLetter: '',
    rMulti: false,
    rOpts: [] as { k: string; text: string; state: string }[],
    picked: '',
    answered: false,
    wasCorrect: false,
    nextDays: 0,
    rStreak: 0,
    rVerdict: '',
    celebrate: false,
    celebrateN: 0,
    celebrateMastered: 0,
    celebrateNext: '',
    dueLeft: 0,
    celebrateCopy: reviewDoneCopy(0, 0),
    reasonOpts: toOpts(REASONS),
    tabOpts: [
      { value: 'todo', label: '待掌握 0' },
      { value: 'done', label: '已掌握 0' },
      { value: 'fav', label: '收藏 0' },
    ],
    // 错题卡「更多」分组菜单
    opsOpen: false,
    opsKind: 'mistake' as 'mistake' | 'fav',
    opsIdx: -1,
    opsQid: 0,
    opsHasNote: false,
    taSize: { minHeight: 72 },
    noteTaSize: { minHeight: 112 },
    // 筛选/排序
    filterOpen: false,
    sortOpts: SORTS.map((s) => ({ value: s.k, label: s.t })),
    sortBy: 'time',
    filterMod: '',
    modOpts: withAll([]),
    filterType: '',
    typeOpts: withAll([]),
    // 纠错
    reportOpen: false,
    reportTypeOpts: toOpts(REPORT_TYPES),
    reportType: '',
    reportDetail: '',
    reportBusy: false,
    // 收藏夹
    folders: [] as FavFolder[],
    folderId: null as number | null,
    // 笔记
    noteOpen: false,
    noteQid: 0,
    noteDraft: '',
    noteHas: false,
    noteBusy: false,
    recapOpen: false,
    // 工具 4 格：动作型入口，复盘格带本月新增数徽标
    toolItems: [
      { key: 'redo', icon: 'shuffle', label: '错题重练' },
      { key: 'ai', icon: 'sparkles', label: 'AI 分析' },
      { key: 'manual', icon: 'pencil-line', label: '手录错题' },
      { key: 'recap', icon: 'chart-column', label: '本月复盘' },
    ],
    recap: { total: 0, byModule: [] as RecapRow[], byReason: [] as RecapRow[] },
    // 批量操作（H5 batchMode/selIds）
    batchMode: false,
    selIds: {} as Record<string, boolean>,
    selCount: 0,
    batchBusy: false,
    // AI 错题分析
    aiOpen: false,
    aiLoading: false,
    aiHtml: '',
    // 手录错题（自由录入，免 AI；H5 entry*）
    entryOpen: false,
    entry: emptyManualEntry(),
    entryErr: '',
    entrySaving: false,
    entryCorrectRow: letterRow(''),
    entryPickedRow: letterRow(''),
    entryTaSize: { minHeight: 112 },
    manualModOpts: MANUAL_MODULES,
    // 按卷码录入答题卡答案
    manualOpen: false,
    manualCode: '',
    manualLoading: false,
    manualPaper: null as PaperInfo | null,
    manualRows: [] as ManualRow[],
    manualPickedCount: 0,
    manualSubmitting: false,
    // 最近导出过的卷（H5 recentPapers）：录入时一键回填卷码
    recentPapers: [] as { code: string; title: string }[],
    scanBusy: false,
    scanOpen: false,
    scanResult: null as PaperAnswersResp | null,
    scanRows: [] as ScanRow[],
    // 复习断点续做（/api/review/cur）
    resumeInfo: null as ReviewResume | null,
    // 强化建议
    reinforce: null as ReinforceItem | null,
    reinforceMeta: '',
    reinforceItems: [] as ReinforceItem[],
  },
  _shareSid: '',
  _shareTitle: '',
  _manualPicks: {} as Record<string, string>,
  _snapTimer: 0 as ReturnType<typeof setTimeout> | 0,
  _reviewIntent: false,
  _autoScan: false,
  _autoCode: '',
  _qStart: 0,
  onShow() {
    syncTabBar(this, 1);
    // 首页「继续未完成复习」→ tabBar 页无法带参，走 storage 意图位（H5 bookReviewIntent）
    if (wx.getStorageSync('bookReviewIntent')) {
      wx.removeStorageSync('bookReviewIntent');
      this._reviewIntent = true;
    }
    // 导出卷/分享图深链：带回卷码直接开录入，或带图直接拍照判分
    const autoCode = String(wx.getStorageSync('bookManualCode') || '');
    if (autoCode) {
      wx.removeStorageSync('bookManualCode');
      this._autoCode = autoCode;
    }
    if (wx.getStorageSync('bookAutoScan')) {
      wx.removeStorageSync('bookAutoScan');
      this._autoScan = true;
    }
    this.load();
  },
  async load() {
    this.setData({ loading: true });
    try {
      const [m, r, f, fd] = await Promise.all([
        fetchMistakes(),
        fetchReviewDue().catch(() => ({ items: [] as Mistake[], total: 0 })),
        fetchFavs(this.data.folderId).catch(() => ({ items: [] as FavItem[] })),
        fetchFavFolders().catch(() => ({ items: [] as FavFolder[] })),
      ]);
      const all = (m.items || []).map((x) => ({
        ...x,
        modName: modName(x.module),
        typeName: groupName(x),
        streakText: x.mastered ? '' : streakProgressText(x.review_streak),
        open: false,
        optList: optList(x),
      }));
      const modOptions = Array.from(new Set(all.map((x) => x.modName).filter(Boolean)));
      const typeOptions = Array.from(new Set(all.map((x) => x.typeName).filter(Boolean)));
      const todoCount = all.filter((x) => !x.mastered).length;
      const doneCount = all.filter((x) => !!x.mastered).length;
      const stickyCount = all.filter((x) => !x.mastered && x.mastery_state === 'sticky_wrong').length;
      const favs = f.items || [];
      this.setData({
        all,
        modOpts: withAll(modOptions),
        typeOpts: withAll(typeOptions),
        recap: monthRecap(all),
        favs,
        folders: fd.items || [],
        todoCount,
        doneCount,
        toolItems: [
          { key: 'redo', icon: 'shuffle', label: '错题重练' },
          ...(stickyCount ? [{ key: 'stickyPaper', icon: 'target', label: '易错专项卷' }] : []),
          { key: 'ai', icon: 'sparkles', label: 'AI 分析' },
          { key: 'manual', icon: 'pencil-line', label: '手录错题' },
          { key: 'recap', icon: 'chart-column', label: '本月复盘' },
        ],
        tabOpts: [
          { value: 'todo', label: `待掌握 ${todoCount}` },
          { value: 'done', label: `已掌握 ${doneCount}` },
          { value: 'sticky', label: `易错 ${stickyCount}` },
          { value: 'fav', label: `收藏 ${favs.length}` },
        ],
        due: r.items || [],
        dueTotal: r.total || (r.items || []).length,
      });
      if (this.data.celebrate) {
        const dueLeft = this.data.dueTotal;
        this.setData({ dueLeft, celebrateCopy: reviewDoneCopy(this.data.celebrateN, dueLeft) });
      }
      this.applyTab();
      this.restoreSnap();
      if (wx.getStorageSync('autoStartReview') && (r.items || []).length && !this.data.reviewing) {
        wx.removeStorageSync('autoStartReview');
        this.startReview();
      }
      // 深链优先级：拍照判分 > 卷码录入（两者互斥，一次 onShow 只消费一个）
      if (this._autoScan) {
        this._autoScan = false;
        this._autoCode = '';
        this.onScanSheet();
      } else if (this._autoCode) {
        const code = this._autoCode;
        this._autoCode = '';
        this.onManualOpen();
        this.setData({ manualCode: code });
        this.onManualLookup();
      }
    } catch (e) {
      wx.showToast({ title: '加载失败：' + (e as Error).message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
  applyTab() {
    const { tab, all, sortBy, filterMod, filterType } = this.data;
    let shown =
      tab === 'todo'
        ? all.filter((x) => !x.mastered)
        : tab === 'done'
          ? all.filter((x) => !!x.mastered)
          : tab === 'sticky'
            ? all.filter((x) => !x.mastered && x.mastery_state === 'sticky_wrong')
            : [];
    if (filterMod) shown = shown.filter((x) => x.modName === filterMod);
    if (filterType) shown = shown.filter((x) => x.typeName === filterType);
    shown = [...shown];
    if (sortBy === 'times') {
      shown.sort((a, b) => (b.times || 1) - (a.times || 1));
    } else if (sortBy === 'type') {
      shown.sort((a, b) => (a.question_type || '').localeCompare(b.question_type || ''));
    } else if (sortBy === 'reason') {
      shown.sort((a, b) => (a.error_reason || '未标注').localeCompare(b.error_reason || '未标注'));
    }
    this.setData({ shown });
  },
  // ---------- 筛选/排序 ----------
  onFilterOpen() {
    this.setData({ filterOpen: true });
  },
  onFilterClose() {
    this.setData({ filterOpen: false });
  },
  onFilterVisible(e: VisibleChange) {
    if (!e.detail.visible) this.onFilterClose();
  },
  onPickSort(e: ChipChange) {
    this.setData({ sortBy: String(e.detail.value) });
    this.applyTab();
  },
  onPickMod(e: ChipChange) {
    const v = String(e.detail.value || '');
    this.setData({ filterMod: this.data.filterMod === v ? '' : v });
    this.applyTab();
  },
  onPickType(e: ChipChange) {
    const v = String(e.detail.value || '');
    this.setData({ filterType: this.data.filterType === v ? '' : v });
    this.applyTab();
  },
  onFilterReset() {
    this.setData({ sortBy: 'time', filterMod: '', filterType: '' });
    this.applyTab();
  },
  onTab(e: ChipChange) {
    this.setData({ tab: e.detail.value as 'todo' | 'done' | 'sticky' | 'fav' });
    this.applyTab();
  },
  // 「更多」分组菜单：只做弹层开关 + 把选中项转发给原有处理函数（dataset 原样传递）
  onOpsOpen(e: WechatMiniprogram.TouchEvent) {
    const d = e.currentTarget.dataset;
    this.setData({
      opsOpen: true,
      opsKind: d.kind === 'fav' ? 'fav' : 'mistake',
      opsIdx: Number(d.index),
      opsQid: Number(d.qid || 0),
      opsHasNote: d.note === 1 || d.note === '1',
    });
  },
  onOpsClose() {
    this.setData({ opsOpen: false });
  },
  onOpsVisible(e: VisibleChange) {
    if (!e.detail.visible) this.onOpsClose();
  },
  onOpsPick(e: WechatMiniprogram.TouchEvent) {
    this.onOpsClose();
    const act = String(e.currentTarget.dataset.act || '');
    if (act === 'note') this.onNoteOpen(e);
    else if (act === 'share') this.onShareQ(e);
    else if (act === 'report') this.onReportOpen(e);
    else if (act === 'unfav') this.onUnfav(e);
    else if (act === 'similar') this.onSimilarEntry(e);
  },
  // ---------- 「练一道同类题」（B6：错题卡 ops → ask 页 simSeed 深链） ----------
  onSimilarEntry(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.index);
    const m = this.data.shown[idx];
    if (!m) return;
    // 题干拼上选项文字，同类题才有完整上下文（Mistake.options 为 {A:'..'} 映射）
    const opts = m.options
      ? '\n' + Object.keys(m.options).sort().map((k) => k + '. ' + m.options![k]).join('\n')
      : '';
    wx.setStorageSync('simSeed', {
      q: (m.question_text || '') + opts,
      qt: m.question_type || '',
      mod: m.module || '',
      modName: m.modName || '',
    });
    wx.navigateTo({ url: '/pkgSocial/ask/ask' });
    trackEvent('similar_entry_book');
  },
  onToggle(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.index);
    const m = this.data.shown[idx];
    if (!m) return;
    if (this.data.batchMode) {
      this.toggleSel(m.id);
      return;
    }
    const open = !m.open;
    this.setData({ [`shown[${idx}].open`]: open });
    // H5 toggleCard：展开时拉该题历次作答记录（/api/attempts）
    if (open && m.question_id && !m.attempts) {
      fetchAttempts(m.question_id)
        .then((d) => {
          const cur = this.data.shown[idx];
          if (cur && cur.id === m.id) this.setData({ [`shown[${idx}].attempts`]: fmtAttempts(d.items || []) });
        })
        .catch(() => {});
    }
  },
  // ---------- 批量操作 ----------
  onToggleBatch() {
    this.setData({ batchMode: !this.data.batchMode, selIds: {}, selCount: 0 });
  },
  toggleSel(id: number) {
    const sel = { ...this.data.selIds };
    if (sel[id]) delete sel[id];
    else sel[id] = true;
    this.setData({ selIds: sel, selCount: Object.keys(sel).length });
  },
  onSelAll() {
    const shown = this.data.shown;
    if (this.data.selCount === shown.length) {
      this.setData({ selIds: {}, selCount: 0 });
      return;
    }
    const sel: Record<string, boolean> = {};
    shown.forEach((m) => {
      sel[m.id] = true;
    });
    this.setData({ selIds: sel, selCount: shown.length });
  },
  async onBatchMaster(e: WechatMiniprogram.TouchEvent) {
    const on = String(e.currentTarget.dataset.on) === '1';
    const { selCount, batchBusy, selIds } = this.data;
    if (!selCount || batchBusy) return;
    this.setData({ batchBusy: true });
    try {
      await Promise.all(Object.keys(selIds).map((id) => patchMistake(Number(id), { mastered: on ? 1 : 0 })));
      wx.showToast({ title: (on ? '已掌握 ' : '已恢复复习 ') + selCount + ' 题', icon: 'none' });
    } catch (err) {
      wx.showToast({ title: '部分操作失败：' + (err as Error).message, icon: 'none' });
    } finally {
      this.setData({ selIds: {}, selCount: 0, batchBusy: false });
      this.load();
    }
  },
  onBatchDel() {
    const { selCount, batchBusy, selIds } = this.data;
    if (!selCount || batchBusy) return;
    wx.showModal({
      title: '删除选中的 ' + selCount + ' 道错题？',
      content: '删除后不可恢复，也不再进入复习队列',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ batchBusy: true });
        try {
          await Promise.all(Object.keys(selIds).map((id) => deleteMistake(Number(id))));
          wx.showToast({ title: '已删除 ' + selCount + ' 题', icon: 'none' });
        } catch (err) {
          wx.showToast({ title: '部分删除失败：' + (err as Error).message, icon: 'none' });
        } finally {
          this.setData({ selIds: {}, selCount: 0, batchBusy: false });
          this.load();
        }
      },
    });
  },
  // ---------- AI 错题分析 ----------
  async onAiAnalysis() {
    this.setData({ aiOpen: true });
    if (this.data.aiHtml || this.data.aiLoading) return;
    this.setData({ aiLoading: true });
    try {
      const d = await mistakeAnalysis();
      this.setData({ aiHtml: md(d.analysis || '分析失败，请稍后重试') });
    } catch (err) {
      this.setData({ aiHtml: md('分析失败：' + (err as Error).message) });
    }
    this.setData({ aiLoading: false });
  },
  onAiClose() {
    this.setData({ aiOpen: false });
  },
  onAiRetry() {
    this.setData({ aiHtml: '' });
    this.onAiAnalysis();
  },
  // ---------- 手动录入答案（按卷：/api/paper/{code} → /api/paper_answers） ----------
  onManualOpen() {
    this._manualPicks = {};
    const recentPapers = (wx.getStorageSync('recentPapers') || []) as { code: string; title: string }[];
    this.setData({
      manualOpen: true, manualPaper: null, manualCode: '', manualRows: [], manualPickedCount: 0,
      recentPapers: Array.isArray(recentPapers) ? recentPapers.slice(0, 5) : [],
    });
  },
  onRecentPaper(e: WechatMiniprogram.TouchEvent) {
    const code = String(e.currentTarget.dataset.code || '');
    if (!code) return;
    this.setData({ manualCode: code });
    this.onManualLookup();
  },
  // ---------- 拍照判分（B5：打印答题卡 OMR 识别，/api/scan_sheet） ----------
  onScanSheet() {
    if (this.data.scanBusy) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: async (res) => {
        const filePath = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath;
        if (!filePath) return;
        this.setData({ scanBusy: true });
        wx.showLoading({ title: '识别答题卡…', mask: true });
        try {
          const d = await scanSheet(filePath);
          // scan_sheet 行缺 module/secs：补齐为录入判分同款行结构
          const res: PaperAnswersResp = {
            ...d,
            title: d.title ?? null,
            items: (d.items || []).map((it) => ({
              no: it.no,
              question_id: it.question_id ?? null,
              module: null,
              picked: it.picked || null,
              answer: it.answer || null,
              correct: it.correct,
              status: it.status,
              secs: 0,
              question: it.question || '',
            })),
          };
          this.setData({ manualOpen: false, scanResult: res, scanRows: buildScanRows(res), scanOpen: true });
          trackEvent('scan_sheet_done');
        } catch (err) {
          wx.showToast({ title: (err as Error).message || '识别失败，请重拍', icon: 'none', duration: 3000 });
        } finally {
          wx.hideLoading();
          this.setData({ scanBusy: false });
        }
      },
    });
  },
  onManualClose() {
    this.setData({ manualOpen: false });
  },
  // ---------- 手录错题（H5 entryOpenSheet/entrySubmit） ----------
  onEntryOpen() {
    const e = this.data.entry;
    const fresh = !e.question && !e.correct ? emptyManualEntry() : e;
    this.setData({ entryOpen: true, entryErr: '', entry: fresh, entryCorrectRow: letterRow(fresh.correct), entryPickedRow: letterRow(fresh.picked) });
    trackEvent('manual_entry_open');
  },
  onEntryClose() {
    this.setData({ entryOpen: false });
  },
  onEntryToPaper() {
    this.setData({ entryOpen: false });
    this.onManualOpen();
  },
  onEntryModule(e: ChipChange) {
    this.setData({ 'entry.module': String(e.detail.value || ''), entryErr: '' });
  },
  onEntryQuestion(e: ChipChange) {
    this.setData({ 'entry.question': String(e.detail.value || '') });
  },
  onEntryExplanation(e: ChipChange) {
    this.setData({ 'entry.explanation': String(e.detail.value || '') });
  },
  onEntryReason(e: ChipChange) {
    const v = String(e.detail.value || '');
    this.setData({ 'entry.reason': this.data.entry.reason === v ? '' : v });
  },
  onEntryCorrect(e: WechatMiniprogram.TouchEvent) {
    const next = toggleLetter(this.data.entry.correct, String(e.currentTarget.dataset.l || ''));
    this.setData({ 'entry.correct': next, entryCorrectRow: letterRow(next), entryErr: '' });
  },
  onEntryPicked(e: WechatMiniprogram.TouchEvent) {
    const next = toggleLetter(this.data.entry.picked, String(e.currentTarget.dataset.l || ''));
    this.setData({ 'entry.picked': next, entryPickedRow: letterRow(next), entryErr: '' });
  },
  async onEntrySubmit() {
    if (this.data.entrySaving) return;
    const err = manualEntryError(this.data.entry);
    if (err) {
      this.setData({ entryErr: err });
      return;
    }
    this.setData({ entrySaving: true, entryErr: '' });
    try {
      const d = await postManualMistake(manualEntryBody(this.data.entry));
      const tip = manualSavedToast(d && d.id, this.data.all);
      this.setData({ entry: emptyManualEntry(), entryCorrectRow: letterRow(''), entryPickedRow: letterRow(''), entryOpen: false });
      wx.showToast({ title: tip, icon: 'none' });
      trackEvent('manual_entry_save');
      await this.load();
    } catch (e) {
      this.setData({ entryErr: (e instanceof Error && e.message) || '保存失败，请重试' });
    } finally {
      this.setData({ entrySaving: false });
    }
  },
  onManualCode(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ manualCode: String(e.detail.value || '') });
  },
  async onManualLookup() {
    const code = String(this.data.manualCode || '').trim().toUpperCase();
    if (!code) {
      wx.showToast({ title: '请输入卷码', icon: 'none' });
      return;
    }
    if (this.data.manualLoading) return;
    this.setData({ manualLoading: true });
    try {
      const p = await fetchPaperInfo(code);
      this._manualPicks = {};
      this.setData({ manualPaper: p, manualRows: buildManualRows(p.n, {}), manualPickedCount: 0 });
    } catch (err) {
      wx.showToast({ title: (err as Error).message || '未找到试卷', icon: 'none', duration: 3000 });
    }
    this.setData({ manualLoading: false });
  },
  onManualPick(e: WechatMiniprogram.TouchEvent) {
    const { no, l } = e.currentTarget.dataset as { no: number; l: string };
    const key = String(no);
    const cur = { ...this._manualPicks };
    if (cur[key] === l) delete cur[key];
    else cur[key] = l;
    this._manualPicks = cur;
    const p = this.data.manualPaper;
    this.setData({ manualRows: buildManualRows(p ? p.n : 0, cur), manualPickedCount: Object.keys(cur).length });
  },
  onManualBack() {
    this._manualPicks = {};
    this.setData({ manualPaper: null, manualRows: [], manualPickedCount: 0 });
  },
  async onManualSubmit() {
    const p = this.data.manualPaper;
    if (!p || this.data.manualSubmitting || !this.data.manualPickedCount) return;
    this.setData({ manualSubmitting: true });
    try {
      const d = await submitPaperAnswers(p.code, this._manualPicks);
      this.setData({ manualOpen: false, scanResult: d, scanRows: buildScanRows(d), scanOpen: true });
    } catch (err) {
      wx.showToast({ title: '判分失败：' + (err as Error).message, icon: 'none', duration: 3000 });
    }
    this.setData({ manualSubmitting: false });
  },
  onScanClose() {
    this.setData({ scanOpen: false });
  },
  onScanDone() {
    this.setData({ scanOpen: false });
    this.load();
  },
  async onMaster(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.index);
    const m = this.data.shown[idx];
    if (!m) return;
    const on = !m.mastered;
    try {
      await patchMistake(m.id, { mastered: on ? 1 : 0 });
      wx.showToast({ title: on ? '已标记掌握' : '已移回待掌握', icon: 'none' });
      this.load();
    } catch (err) {
      wx.showToast({ title: '操作失败：' + (err as Error).message, icon: 'none' });
    }
  },
  // 错题卡分享给队友：生成 sid → 复制链接，右上角转发卡片直达分享作答页
  async onShareQ(e: WechatMiniprogram.TouchEvent) {
    const m = this.data.shown[Number(e.currentTarget.dataset.index)];
    if (!m || !m.question_id) {
      wx.showToast({ title: '该题暂不支持分享', icon: 'none' });
      return;
    }
    try {
      const d = await shareCreate(m.question_id);
      const mod = d.submodule || modName(d.module || '');
      this._shareSid = d.sid;
      this._shareTitle = `我考你一道${mod}题，你能做对吗？`;
      trackEvent('share_copy', 'share_q', d.sid);
      wx.setClipboardData({
        data: `【${mod}】我刚在错题邦做了一道题，你能做对吗？答完就能看到大家选了啥：https://kaogong.zalize.com/s/${d.sid}`,
        success: () =>
          wx.showToast({ title: '链接已复制，也可点右上角转发给队友', icon: 'none' }),
      });
    } catch (err) {
      wx.showToast({ title: (err as Error).message || '分享失败', icon: 'none' });
    }
  },

  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    if (this._shareSid) {
      return {
        title: this._shareTitle || '我分享了一道错题，敢来挑战吗？',
        path: `/pages/share/share?sid=${this._shareSid}`,
      };
    }
    return { title: '一起来刷题' };
  },

  // 错题重练（H5 redoAll）：带当前模块/题型筛选走 /api/mistakes/redo，结果集交给 practice 的 redoset 模式
  async onRedo() {
    const { filterMod, filterType } = this.data;
    try {
      const f: { module?: string | null; qtype?: string | null; noqt?: boolean; sub?: string | null } = {};
      const modKey = Object.keys(MODULE_NAMES).find((k) => MODULE_NAMES[k] === filterMod) || null;
      if (filterType) {
        const typeIsMod = Object.keys(MODULE_NAMES).find((k) => MODULE_NAMES[k] === filterType);
        const isGroup = this.data.all.some((x) => x.type_group === filterType);
        if (isGroup) {
          f.sub = filterType;
          if (modKey) f.module = modKey;
        } else if (typeIsMod) {
          f.module = typeIsMod;
          f.noqt = true;
        } else {
          f.qtype = filterType;
        }
      } else if (modKey) {
        f.module = modKey;
      }
      const d = await redoMistakesFiltered({ limit: 10, ...f });
      if (!d.items || !d.items.length) {
        wx.showToast({ title: '错题未能匹配到题库原题', icon: 'none' });
        return;
      }
      wx.setStorageSync('redoSet', d.items);
      const skipped = Math.max(0, Number(d.skipped) || 0);
      wx.navigateTo({
        url: '/pages/practice/practice?mode=redoset&source=redo&count=' + d.items.length + (skipped ? '&skipped=' + skipped : ''),
      });
    } catch (err) {
      wx.showToast({ title: '加载失败：' + (err as Error).message, icon: 'none' });
    }
  },

  // B2：长期易错专项出卷——只出累计再错 ≥2 且未掌握的错题
  async onStickyPaper() {
    const mids = this.data.all
      .filter((x) => !x.mastered && x.mastery_state === 'sticky_wrong')
      .map((x) => x.id);
    if (!mids.length) {
      wx.showToast({ title: '暂无长期易错错题', icon: 'none' });
      return;
    }
    try {
      const d = await redoMistakesFiltered({ limit: 10, mids });
      if (!d.items || !d.items.length) {
        wx.showToast({ title: '易错题未能匹配到题库原题', icon: 'none' });
        return;
      }
      wx.setStorageSync('redoSet', d.items);
      const skipped = Math.max(0, Number(d.skipped) || 0);
      wx.navigateTo({
        url: '/pages/practice/practice?mode=redoset&source=sticky&count=' + d.items.length + (skipped ? '&skipped=' + skipped : ''),
      });
    } catch (err) {
      wx.showToast({ title: '加载失败：' + (err as Error).message, icon: 'none' });
    }
  },

  // ---------- 题目纠错 ----------
  _reportIdx: -1,
  onReportOpen(e: WechatMiniprogram.TouchEvent) {
    this._reportIdx = Number(e.currentTarget.dataset.index);
    this.setData({ reportOpen: true, reportType: '', reportDetail: '' });
  },
  onReportClose() {
    this.setData({ reportOpen: false });
  },
  onReportVisible(e: VisibleChange) {
    if (!e.detail.visible) this.onReportClose();
  },
  onPickReportType(e: ChipChange) {
    this.setData({ reportType: String(e.detail.value) });
  },
  onReportDetail(e: ChipChange) {
    this.setData({ reportDetail: e.detail.value });
  },
  async onReportSubmit() {
    const m = this.data.shown[this._reportIdx];
    if (!m || !m.question_id || !this.data.reportType || this.data.reportBusy) return;
    this.setData({ reportBusy: true });
    try {
      await postQuestionReport(m.question_id, this.data.reportType, this.data.reportDetail.slice(0, 500));
      this.setData({ reportOpen: false });
      wx.showToast({ title: '感谢反馈，我们会尽快核查', icon: 'none' });
    } catch (err) {
      wx.showToast({ title: '提交失败：' + (err as Error).message, icon: 'none' });
    } finally {
      this.setData({ reportBusy: false });
    }
  },

  // ---------- 笔记 ----------
  async onNoteOpen(e: WechatMiniprogram.TouchEvent) {
    const qid = Number(e.currentTarget.dataset.qid);
    if (!qid) return;
    this.setData({ noteOpen: true, noteQid: qid, noteDraft: '', noteHas: false });
    try {
      const d = await fetchNote(qid);
      if (this.data.noteQid === qid && d.item) {
        this.setData({ noteDraft: d.item.content, noteHas: true });
      }
    } catch (err) {
      /* 非关键路径 */
    }
  },
  onNoteClose() {
    this.setData({ noteOpen: false });
  },
  onNoteVisible(e: VisibleChange) {
    if (!e.detail.visible) this.onNoteClose();
  },
  onNoteInput(e: ChipChange) {
    this.setData({ noteDraft: e.detail.value });
  },
  async onNoteSave(e: WechatMiniprogram.TouchEvent) {
    const clear = e.currentTarget.dataset.clear === '1';
    const content = clear ? '' : this.data.noteDraft.trim();
    if (this.data.noteBusy || (!clear && !content && !this.data.noteHas)) return;
    this.setData({ noteBusy: true });
    try {
      await saveNote(this.data.noteQid, content);
      this.setData({ noteOpen: false });
      wx.showToast({ title: content ? '笔记已保存' : '笔记已删除', icon: 'none' });
      this.load();
    } catch (err) {
      wx.showToast({ title: '保存失败：' + (err as Error).message, icon: 'none' });
    } finally {
      this.setData({ noteBusy: false });
    }
  },

  // ---------- 收藏 ----------
  onFavPractice(e: WechatMiniprogram.TouchEvent) {
    const mod = String(e.currentTarget.dataset.module || '');
    wx.navigateTo({
      url: '/pages/practice/practice' + (mod ? '?module=' + encodeURIComponent(mod) : ''),
    });
  },
  onPickFolder(e: WechatMiniprogram.TouchEvent) {
    const raw = e.currentTarget.dataset.fid;
    const folderId = raw === 'all' ? null : Number(raw);
    this.setData({ folderId });
    this.load();
  },
  onNewFolder() {
    wx.showModal({
      title: '新建收藏夹',
      editable: true,
      placeholderText: '夹名，如：图推·必背规律',
      success: async (r) => {
        if (!r.confirm || !r.content) return;
        try {
          await createFavFolder(r.content.trim());
          this.load();
        } catch (err) {
          wx.showToast({ title: (err as Error).message, icon: 'none' });
        }
      },
    });
  },
  onFolderOps(e: WechatMiniprogram.TouchEvent) {
    const fid = Number(e.currentTarget.dataset.fid);
    const name = String(e.currentTarget.dataset.name || '');
    if (!fid) return;
    wx.showActionSheet({
      itemList: ['重命名', '删除（夹内收藏移回默认夹）'],
      success: (r) => {
        if (r.tapIndex === 0) {
          wx.showModal({
            title: '重命名收藏夹',
            editable: true,
            content: name,
            success: async (m) => {
              if (!m.confirm || !m.content) return;
              try {
                await renameFavFolder(fid, m.content.trim());
                this.load();
              } catch (err) {
                wx.showToast({ title: (err as Error).message, icon: 'none' });
              }
            },
          });
        } else if (r.tapIndex === 1) {
          wx.showModal({
            title: '删除收藏夹',
            content: `删除「${name}」？夹内收藏会移回默认夹`,
            success: async (m) => {
              if (!m.confirm) return;
              try {
                await deleteFavFolder(fid);
                if (this.data.folderId === fid) this.setData({ folderId: null });
                this.load();
              } catch (err) {
                wx.showToast({ title: (err as Error).message, icon: 'none' });
              }
            },
          });
        }
      },
    });
  },
  async onUnfav(e: WechatMiniprogram.TouchEvent) {
    const qid = Number(e.currentTarget.dataset.qid);
    if (!qid) return;
    try {
      await deleteFav(qid);
      wx.showToast({ title: '已取消收藏', icon: 'none' });
      this.load();
    } catch (err) {
      wx.showToast({ title: '操作失败：' + (err as Error).message, icon: 'none' });
    }
  },

  // ---------- 遗忘曲线复习 ----------
  onReviewFromCard() {
    trackEvent('review_entry_click', 'book_card');
    this.startReview();
  },
  startReview() {
    const rItems = [...this.data.due] as RItem[];
    if (!rItems.length) return;
    this.setData({ reviewing: true, rItems, rIdx: 0, resumeInfo: null });
    this.resetQ();
    this.saveSnap();
  },
  // ---------- 复习断点（H5 saveReviewSnap/clearReviewSnap/restoreRemoteSnap/resumeReview） ----------
  saveSnap() {
    const { rItems, rIdx, picked, answered, wasCorrect, nextDays } = this.data;
    const snap = buildReviewSnap(
      { rItems: rItems as unknown as Array<Record<string, unknown> & { question_text: string }>, rIdx, picked, answered, wasCorrect, nextDays },
      anonUid(),
      Date.now() / 1000
    );
    if (!snap) return;
    wx.setStorageSync(REVIEW_SNAP_KEY, snap);
    if (this._snapTimer) clearTimeout(this._snapTimer);
    this._snapTimer = setTimeout(() => {
      this._snapTimer = 0;
      saveReviewCur(snap).catch(() => {});
    }, 1500);
  },
  clearSnap() {
    wx.removeStorageSync(REVIEW_SNAP_KEY);
    if (this._snapTimer) {
      clearTimeout(this._snapTimer);
      this._snapTimer = 0;
    }
    this.setData({ resumeInfo: null });
    saveReviewCur(null).catch(() => {});
  },
  restoreSnap() {
    if (this.data.reviewing || this.data.resumeInfo) return;
    const uid = anonUid();
    const now = Date.now() / 1000;
    const want = this._reviewIntent;
    this._reviewIntent = false;
    const local = parseReviewSnap(wx.getStorageSync(REVIEW_SNAP_KEY), uid, now);
    if (local) {
      this.setData({ resumeInfo: local });
      if (want) this.onResumeReview();
      return;
    }
    fetchReviewCur()
      .then((r) => {
        if (this.data.reviewing || this.data.resumeInfo) return;
        const info = parseReviewSnap(r && r.snap, uid, Date.now() / 1000);
        if (!info) return;
        this.setData({ resumeInfo: info });
        if (want) this.onResumeReview();
      })
      .catch(() => {});
  },
  onResumeReview() {
    const r = this.data.resumeInfo;
    if (!r) return;
    trackEvent('review_resume_click', 'book');
    const rItems = r.items.map((x) => ({ ...x })) as unknown as RItem[];
    this.setData({ reviewing: true, rItems, rIdx: r.rIdx, resumeInfo: null });
    this.resetQ();
    if (r.answered) {
      this.paintOpts(r.picked || '', true);
      const cur = rItems[r.rIdx];
      const rStreak = Number(cur && cur.streak) || 0;
      this.setData({ answered: true, wasCorrect: r.wasCorrect, nextDays: r.nextDays, rStreak, rVerdict: this.verdictFor(cur, r.wasCorrect, rStreak, r.nextDays) });
    } else if (r.picked) {
      this.paintOpts(r.picked, false);
    }
  },
  onDiscardResume() {
    this.clearSnap();
  },
  resetQ() {
    const cur = this.data.rItems[this.data.rIdx] || null;
    const opts = cur && cur.options ? cur.options : null;
    const rOpts = ['A', 'B', 'C', 'D'].map((k) => ({ k, text: (opts && opts[k]) || '', state: '' }));
    const rLetter = extractLetter(cur ? cur.correct_answer : '');
    this.setData({
      rCur: cur,
      rLetter,
      rMulti: rLetter.length > 1,
      rOpts,
      picked: '',
      answered: false,
      wasCorrect: false,
      nextDays: 0,
      rStreak: 0,
      rVerdict: '',
    });
    this._qStart = Date.now();
  },
  verdictFor(cur: RItem | null, wasCorrect: boolean, streak: number, nextDays: number): string {
    return reviewVerdict({
      extra: !!(cur && cur.extra),
      requeued: !!(cur && cur.requeued),
      wasCorrect,
      streak,
      nextDays,
      mastered: !!(cur && cur.masteredNow),
    });
  },
  // WXML 表达式不支持方法调用（indexOf 等），选项的选中/对错态在这里算好再下发
  paintOpts(picked: string, answered: boolean) {
    const { rLetter, rOpts } = this.data;
    const next = rOpts.map((o) => {
      let state = '';
      if (!answered) state = picked.includes(o.k) ? 'sel' : '';
      else if (rLetter.includes(o.k)) state = 'ok';
      else if (picked.includes(o.k)) state = 'bad';
      else state = 'dim';
      return { ...o, state };
    });
    this.setData({ picked, rOpts: next });
  },
  onReviewPick(e: WechatMiniprogram.TouchEvent) {
    if (this.data.answered) return;
    const o = String(e.currentTarget.dataset.opt);
    if (this.data.rMulti) {
      const set = new Set(this.data.picked.split('').filter(Boolean));
      if (set.has(o)) set.delete(o);
      else set.add(o);
      this.paintOpts(Array.from(set).sort().join(''), false);
      return;
    }
    this.paintOpts(o, true);
    this.recordReview(o === this.data.rLetter, o);
  },
  onConfirmMulti() {
    if (this.data.answered || !this.data.picked) return;
    this.paintOpts(this.data.picked, true);
    this.recordReview(this.data.picked === this.data.rLetter, this.data.picked);
  },
  onSelfJudge(e: WechatMiniprogram.TouchEvent) {
    if (this.data.answered) return;
    this.recordReview(e.currentTarget.dataset.ok === '1');
  },
  async recordReview(correct: boolean, picked?: string) {
    const cur = this.data.rCur;
    if (!cur) return;
    if (cur.extra) {
      this.setData({ answered: true, wasCorrect: correct, rVerdict: this.verdictFor(cur, correct, 0, 0) });
      return;
    }
    const rItems = this.data.rItems;
    if (!correct && !cur.requeued) {
      rItems.push({ ...cur, requeued: true });
    }
    this.setData({ answered: true, wasCorrect: correct, rItems, rVerdict: this.verdictFor(cur, correct, 0, 0) });
    if (!correct) this.appendSimilar(cur);
    try {
      const res = await postReviewRecord(cur.id, correct, picked, reviewElapsedSecs(this._qStart, Date.now()));
      const idx = this.data.rIdx;
      const mastered = res.mastered === true;
      const item = this.data.rItems[idx];
      if (item) {
        item.streak = res.streak;
        item.masteredNow = mastered;
        item.nextDays = res.next_review_days;
      }
      this.setData({
        nextDays: res.next_review_days,
        rStreak: res.streak,
        'rCur.streak': res.streak,
        'rCur.masteredNow': mastered,
        rVerdict: this.verdictFor({ ...cur, masteredNow: mastered }, correct, res.streak, res.next_review_days),
      });
    } catch (e) {
      wx.showToast({ title: '记录失败：' + (e as Error).message, icon: 'none' });
    }
    this.saveSnap();
  },
  // 答错自动加推：本轮末尾追加最多 2 道同类新题（extra 题不写 SRS，不影响复习记录）
  async appendSimilar(cur: RItem) {
    if (cur.simFetched || cur.requeued || !cur.module) return;
    const room = similarRoom(this.data.rItems);
    if (!room) return;
    const idx = this.data.rIdx;
    this.setData({ [`rItems[${idx}].simFetched`]: true, 'rCur.simFetched': true });
    const qt = cur.question_type || '';
    const sub = qt.indexOf('-') > -1 ? qt.split('-').slice(1).join('-') : null;
    try {
      const d = await fetchQuestions({ limit: room, module: cur.module, submodule: sub });
      const add: RItem[] = (d.items || [])
        .filter((x) => x.id !== cur.question_id)
        .slice(0, room)
        .map((x) => ({
          id: -1,
          question_id: x.id,
          extra: true,
          module: x.module,
          question_text:
            x.question +
            '\n' +
            Object.keys(x.options || {})
              .sort()
              .map((k) => `${k}.${x.options[k]}`)
              .join(' '),
          user_answer: '',
          correct_answer: x.answer,
          explanation: x.hs_explanation || x.explanation || '',
          options: x.options || null,
        }));
      if (add.length) {
        const rItems = this.data.rItems.concat(add);
        this.setData({ rItems, [`rItems[${idx}].appended`]: add.length, 'rCur.appended': add.length });
        trackEvent('review_similar_auto', cur.module || '');
      }
    } catch (e) {
      /* 非关键路径 */
    }
  },
  async onReviewReason(e: ChipChange) {
    const rz = String(e.detail.value || '');
    const cur = this.data.rCur;
    if (!cur || cur.extra) return;
    const i = this.data.rIdx;
    this.setData({ 'rCur.error_reason': rz, [`rItems[${i}].error_reason`]: rz });
    try {
      await patchMistake(cur.id, { error_reason: rz });
      trackEvent('review_reason_tag', rz || '未标注');
    } catch (err) {
      /* 非关键路径 */
    }
  },
  onNextReview() {
    if (this.data.rIdx + 1 < this.data.rItems.length) {
      this.setData({ rIdx: this.data.rIdx + 1 });
      this.resetQ();
      this.saveSnap();
    } else {
      const items = this.data.rItems;
      const n = items.filter((x) => !x.extra && !x.requeued).length;
      const celebrateMastered = items.filter((x) => !x.extra && x.masteredNow === true).length;
      const celebrateNext = nextReviewText(items);
      const dueLeft = reviewDueLeft(this.data.dueTotal, n);
      this.exitReview();
      this.setData({
        celebrate: true,
        celebrateN: n,
        celebrateMastered,
        celebrateNext,
        dueLeft,
        celebrateCopy: reviewDoneCopy(n, dueLeft),
        reinforce: null,
        reinforceItems: [],
      });
      trackEvent('review_done_celebrate', 'book');
      this.fetchReinforce();
    }
  },
  // ---------- 强化建议（H5 fetchReinforce/swapReinforce/startReinforce） ----------
  async fetchReinforce() {
    try {
      const d = await fetchReinforceSuggest();
      if (!this.data.celebrate) return;
      this.setData({ reinforceItems: d.items || [], reinforce: d.picked || null, reinforceMeta: d.picked ? reinforceMeta(d.picked) : '' });
    } catch (e) {
      /* 非关键路径 */
    }
  },
  onSwapReinforce() {
    const { reinforceItems, reinforce } = this.data;
    if (!reinforce || reinforceItems.length < 2) return;
    const i = reinforceItems.findIndex((x) => x.skill === reinforce.skill);
    const next = reinforceItems[(i + 1) % reinforceItems.length];
    this.setData({ reinforce: next, reinforceMeta: reinforceMeta(next) });
  },
  onStartReinforce() {
    const r = this.data.reinforce;
    if (!r) return;
    this.setData({ reinforce: null, celebrate: false });
    let url = '/pages/practice/practice?count=5&source=reinforce&adaptive=1&module=' + encodeURIComponent(r.module);
    if (r.submodule) url += '&submodule=' + encodeURIComponent(r.submodule);
    if (r.tag3) url += '&tag3=' + encodeURIComponent(r.tag3);
    wx.navigateTo({ url });
  },
  onToggleRecap() {
    this.setData({ recapOpen: !this.data.recapOpen });
  },
  onTool(e: WechatMiniprogram.CustomEvent<{ key: string }>) {
    const k = e.detail.key;
    if (k === 'redo') {
      if (this.data.todoCount) this.onRedo();
      else wx.showToast({ title: '暂无待掌握错题', icon: 'none' });
    } else if (k === 'stickyPaper') this.onStickyPaper();
    else if (k === 'ai') this.onAiAnalysis();
    else if (k === 'manual') this.onEntryOpen();
    else if (k === 'recap') {
      if (this.data.recap.total) this.onToggleRecap();
      else wx.showToast({ title: '本月还没有新增错题', icon: 'none' });
    }
  },
  onCloseCelebrate() {
    if (!this.data.celebrate) return;
    this.setData({ celebrate: false, reinforce: null });
  },
  async onContinueReview() {
    trackEvent('review_entry_click', 'next_batch');
    this.setData({ celebrate: false, reinforce: null });
    await this.load();
    if (this.data.due.length) this.startReview();
    else wx.showToast({ title: '到期错题已复习完', icon: 'none' });
  },
  onCelebrateVisible(e: VisibleChange) {
    if (!e.detail.visible) this.onCloseCelebrate();
  },
  noop() {
    /* 阻断冒泡 */
  },
  exitReview() {
    this.setData({ reviewing: false, rItems: [], rCur: null });
    this.clearSnap();
    this.load();
  },
});
