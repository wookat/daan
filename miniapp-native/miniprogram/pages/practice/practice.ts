import {
  fetchCheckinBadges,
  fetchReviewDue,
  postAnswerLog,
  postMistake,
  deleteFav,
  fetchNote,
  postPracticeResult,
  postQuestionReport,
  saveNote,
  shareCreate,
  trackEvent,
} from '../../api/index';
import {
  drawQuestions,
  fetchAnnouncement,
  fetchCommentCount,
  fetchFavStatus,
  fetchPracticeResume,
  patchMistakeReason,
  postPracticeProgress,
  rateExplanation,
  redoMistakesFiltered,
  savePracticePref,
  setFav,
} from '../../api/learn';
import type { Announcement } from '../../api/learn';
import type { AnswerLogItem, AnswerLogReviewed, Question } from '../../api/types';
import { askPrefill, openExplain } from '../../utils/ask-prefill';
import { anonUid } from '../../utils/auth';
import { doneBarPlan } from '../../utils/done-bar';
import { backLabel } from '../../utils/back-label';
import type { DoneAct, DoneBar } from '../../utils/done-bar';
import { enqueueAnswers, enqueueMistake, flushOfflineQueue } from '../../utils/offline';
import { drawOffline } from '../../utils/offline-pack';
import {
  adoptPracticeResume,
  collectPracticeProgress,
  PENDING_KEY,
  PP_CLEARED_KEY,
  readPendingSession,
} from '../../utils/practice-progress';
import type { PendingSession, ProgressQuestion } from '../../utils/practice-progress';
import { redoSkippedNote } from '../../utils/redo-note';
import { fixReportOf, fixReportText, redoReportOf, redoReportTip } from '../../utils/review-advance';
import type { FixReport, RedoReport } from '../../utils/review-advance';
import { imgUrl } from '../../utils/request';
import { kpChain, qStatLine, sourceLabel } from '../../utils/q-stat';
import { modName, recordStat, streakDays } from '../../utils/stats';

const BADGE_MILESTONES = [3, 7, 14, 30, 60, 100];

const FONT_LABELS = ['小', '标', '大'];
// px 三档（对应 token --fs-sub / --fs-body / --fs-h3 附近）
const Q_FS = [14, 16, 18];
const OPT_FS = [13, 15, 17];
const EXP_FS = [12, 14, 16];

// 与 practice.vue 同口径
const REASONS = ['粗心大意', '概念不清', '方法不会', '纯蒙的'];
const REPORT_TYPES = ['答案错误', '解析错误', '题干或选项错字', '图片缺失', '分类错误', '重复题', '其他'];
const TARGET_SECS: Record<string, number> = { changshi: 40, yanyu: 50, shuliang: 90, panduan: 60, ziliao: 80 };
const DISCUSS_URL = '/pkgSocial/discuss/discuss?qid=';

function fmtSecs(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m < 10 ? '0' + m : m}:${r < 10 ? '0' + r : r}`;
}

interface PQuestion extends ProgressQuestion {
  _picked: string;
  _secs: number;
  _logged: boolean;
  _saved: boolean;
  _excl: string[];
  _mid: number | null;
  _reason: string;
  _reported: boolean;
  optList: Array<{ k: string; v: string; x: boolean }>;
}

function optListOf(options: Record<string, string>, excl: string[]): Array<{ k: string; v: string; x: boolean }> {
  return Object.keys(options || {})
    .sort()
    .map((k) => ({ k, v: options[k], x: excl.includes(k) }));
}

function toPQ(q: Question | ProgressQuestion): PQuestion {
  const pq = q as ProgressQuestion;
  const excl = Array.isArray(pq._excl) ? pq._excl : [];
  return {
    ...q,
    // 时政题（_sz）的 id 属 shizheng_questions，与题库 id 撞号：置空让作答/错题/收藏/讨论/纠错/分享全部按无题号 fail-closed（H5 practice.vue 同口径）
    id: q._sz ? null : q.id,
    _picked: pq._picked || '',
    _secs: pq._secs || 0,
    _logged: !!pq._logged,
    _saved: false,
    _excl: excl,
    _mid: null,
    _reason: '',
    _reported: false,
    optList: optListOf(q.options, excl),
  };
}

interface LaunchArgs {
  module: string | null;
  submodule: string | null;
  tag3: string | null;
  count: number;
  mode: string;
  source: string | null;
  real: boolean;
  year: string;
  region: string;
  adaptive: boolean;
  ptitle: string;
  skipped: number;
}

Page({
  data: {
    loading: true,
    loadHint: '正在出题…',
    items: [] as PQuestion[],
    idx: 0,
    cur: null as PQuestion | null,
    curImg: '',
    curStat: '',
    curKp: '',
    curSource: '',
    loadErr: '',
    picked: '',
    right: 0,
    streak: 0,
    finished: false,
    pct: 0,
    percentile: null as number | null,
    moduleName: '',
    navTitle: '专项练习',
    totalSecs: 0,
    wrongCount: 0,
    backLabel: '返回首页',
    doneBar: doneBarPlan(0, false) as DoneBar,
    answeredCount: 0,
    dueReview: 0,
    redoReport: null as RedoReport | null,
    redoTip: '',
    fixReport: null as FixReport | null,
    fixText: '',
    timerText: '00:00',
    overtime: false,
    targetSecs: 60,
    offline: false,
    fontLv: 1,
    fontLabel: FONT_LABELS[1],
    qFs: Q_FS[1],
    optFs: OPT_FS[1],
    expFs: EXP_FS[1],
    // 设置项（H5 练习工具 sheet）
    beiMode: false,
    autoNext: true,
    timedMode: false,
    vibrate: true,
    toolsOpen: false,
    cardOpen: false,
    cardCells: [] as Array<{ i: number; cls: string }>,
    // 公告条
    announce: null as Announcement | null,
    // 每题社交/工具态
    isFav: false,
    favNote: '',
    commentN: 0,
    hsRated: '' as '' | 'up' | 'down',
    reasons: REASONS,
    // 纠错
    reportOpen: false,
    reportTypes: REPORT_TYPES,
    reportType: '',
    reportDetail: '',
    reportBusy: false,
    // 笔记
    noteOpen: false,
    noteDraft: '',
    noteBusy: false,
  },
  _args: null as LaunchArgs | null,
  // 最近一次非「本组错题重练」的启动参数：重练后「再来一组」回到原题组规模/标题（H5 retryGroup → start(lastModule) 同口径）
  _groupArgs: null as LaunchArgs | null,
  _source: null as string | null,
  _module: null as string | null,
  _submodule: null as string | null,
  _ptitle: '',
  _qsecs: 0,
  _timer: 0 as number | ReturnType<typeof setInterval>,
  _autoTimer: 0 as number | ReturnType<typeof setTimeout>,
  _progressTimer: 0 as number | ReturnType<typeof setTimeout>,
  _resultSent: false,
  _shareSid: '',
  _shareTitle: '',
  _badgeChecking: false,
  _starting: false,
  _bestStreak: 0,
  _favSeq: 0,
  _reviewed: [] as AnswerLogReviewed[],
  _logPending: [] as Promise<unknown>[],

  onLoad(query: Record<string, string>) {
    const savedFont = wx.getStorageSync('fontLv');
    if (savedFont === 0 || savedFont === 2) this.applyFont(savedFont);
    this.setData({
      backLabel: backLabel(getCurrentPages()),
      beiMode: !!wx.getStorageSync('beiMode'),
      autoNext: !wx.getStorageSync('autoNextOff'),
      timedMode: !!wx.getStorageSync('timedMode'),
      vibrate: !wx.getStorageSync('vibrateOff'),
    });
    const dec = (v: string | undefined) => (v ? decodeURIComponent(v) : '');
    const realFromQuery = query.real != null;
    const args: LaunchArgs = {
      module: query.module || null,
      submodule: dec(query.submodule) || null,
      tag3: dec(query.tag3) || null,
      count: Number(query.count) || Number(wx.getStorageSync('groupSize')) || 10,
      mode: query.mode || '',
      source: query.source || null,
      real: realFromQuery ? query.real === '1' : !!wx.getStorageSync('realMode'),
      year: realFromQuery ? query.year || '' : String(wx.getStorageSync('realYear') || ''),
      region: realFromQuery ? dec(query.region) : String(wx.getStorageSync('realRegion') || ''),
      adaptive: query.adaptive === '1' || (!!query.tag3 && query.adaptive !== '0'),
      ptitle: dec(query.ptitle),
      skipped: Math.max(0, Number(query.skipped) || 0),
    };
    this._args = args;
    flushOfflineQueue();
    this.loadAnnounce();
    if (query.resume === '1') {
      this.tryResume(true);
      return;
    }
    const bare = !query.module && !query.submodule && !query.tag3 && !query.mode && !query.count;
    if (bare) {
      // 裸直达：先问续做，再按上次模块开练（practice.vue onShow 同序）
      this.tryResume(false);
      return;
    }
    this.start(args);
  },
  onHide() {
    this.clearAutoTimer();
    this.flushProgress();
  },
  onUnload() {
    this.stopTimer();
    this.clearAutoTimer();
    this.flushProgress();
    // 中途退出：把已答未上报的作答补报（与 practice.vue quit 对齐）
    this.logAttempts(this.data.items);
  },

  // ---------- 启动 / 续做 ----------

  async start(args: LaunchArgs) {
    if (this._starting) return;
    this._starting = true;
    this._args = args;
    if (args.mode !== 'redoset') this._groupArgs = args;
    this._source = args.source;
    this._module = args.module;
    this._submodule = args.submodule;
    this._ptitle = args.ptitle;
    this._resultSent = false;
    this._reviewed = [];
    this._logPending = [];
    this.setData({
      loading: true,
      finished: false,
      redoReport: null,
      redoTip: '',
      fixReport: null,
      fixText: '',
      loadErr: '',
      loadHint: args.real ? '正在按真题筛选出题…' : '正在出题…',
      moduleName: modName(args.module || ''),
      navTitle: this.navTitleFor(args),
      offline: false,
    });
    const limit = args.count || 10;
    try {
      let d: { items: Question[]; skipped?: number };
      if (args.mode === 'redo') {
        d = await redoMistakesFiltered({ limit, module: args.module, qtype: args.submodule });
      } else if (args.mode === 'redoset') {
        const set = wx.getStorageSync<Question[] | ''>('redoSet');
        wx.removeStorageSync('redoSet');
        d = { items: Array.isArray(set) ? set : [] };
      } else {
        const base = {
          limit,
          module: args.module,
          submodule: args.submodule,
          tag3: args.tag3,
          adaptive: args.adaptive,
          real: args.real,
          year: args.year || null,
          region: args.region || null,
          grouped: args.module === 'ziliao' && !args.submodule && !args.tag3 && !args.real,
          mode: args.mode === 'reinforce' ? ('reinforce' as const) : ('' as const),
          mixDue: args.mode !== 'reinforce',
        };
        d = await drawQuestions(base);
        // 逐级放宽（practice.vue start 同序）：去 tag3 → 去 submodule → 去年份地区 → 去真题
        if (!d.items.length && args.tag3) d = await drawQuestions({ ...base, tag3: null });
        if (!d.items.length && args.submodule) {
          this._submodule = null;
          d = await drawQuestions({ ...base, tag3: null, submodule: null });
        }
        if (!d.items.length && args.real && (args.year || args.region)) {
          wx.showToast({ title: '该年份/地区暂无此模块真题，已放宽筛选', icon: 'none' });
          d = await drawQuestions({ limit, module: args.module, real: true });
        }
        if (!d.items.length && args.real) {
          wx.showToast({ title: '真题还在搜集中，已切回题库模式', icon: 'none' });
          d = await drawQuestions({ limit, module: args.module, mixDue: true });
        }
      }
      if (!d.items || !d.items.length) {
        this.setData({ loading: false, loadErr: '该模块暂无题目，换个模块试试' });
        return;
      }
      this.adopt(d.items.map(toPQ), 0, 0, 0, 0);
      if (args.mode === 'redo' || args.mode === 'redoset') {
        const note = redoSkippedNote(d.items.length + (Number(d.skipped) || args.skipped), d.items.length);
        if (note) wx.showToast({ title: '错题重练开始 · ' + note, icon: 'none', duration: 3500 });
        else wx.showToast({ title: '错题重练开始', icon: 'none' });
      }
      wx.setStorageSync('lastModule', args.module || '');
    } catch (e) {
      // 无网络：用已下载的离线题包（本地判分，作答记录进队列待同步）
      const off = args.module && !args.mode ? drawOffline(args.module, limit) : null;
      if (off && off.length) {
        this.adopt(off.map(toPQ), 0, 0, 0, 0);
        this.setData({ offline: true });
        wx.showToast({ title: '当前无网络，已切换离线题包模式', icon: 'none', duration: 1800 });
      } else {
        this.setData({ loading: false, loadErr: (e as Error).message || '网络不稳定或服务暂时无响应' });
      }
    } finally {
      this._starting = false;
    }
  },

  navTitleFor(a: LaunchArgs): string {
    if (a.ptitle) return a.ptitle;
    if (a.mode === 'redo' || a.mode === 'redoset') return '错题重练';
    if (a.mode === 'reinforce') return '强化练习';
    const mod = modName(a.module || '') || '综合';
    if (a.tag3) return mod + ' · ' + a.tag3;
    if (a.submodule) return mod + ' · ' + a.submodule;
    return mod + (a.real ? ' · 真题' : ' · 专项练习');
  },

  // 统一进入作答态：items 已带 _picked（续做）或全空（新开）
  adopt(items: PQuestion[], idx: number, right: number, streak: number, bestStreak: number) {
    this._bestStreak = bestStreak;
    const i = Math.min(Math.max(idx, 0), items.length - 1);
    const cur = items[i];
    this.setData({
      loading: false,
      loadErr: '',
      finished: false,
      items,
      idx: i,
      cur,
      curImg: imgUrl(cur.image),
      curStat: qStatLine(cur),
      curKp: kpChain(cur, modName(cur.module)),
      curSource: sourceLabel(cur),
      picked: cur._picked || '',
      right,
      streak,
      wrongCount: items.filter((q) => q._picked && q._picked !== q.answer).length,
      answeredCount: items.filter((q) => q._picked).length,
      targetSecs: TARGET_SECS[cur.module] || 60,
      percentile: null,
      hsRated: '',
    });
    this.refreshCardCells();
    this.loadSocial(cur);
    if (!cur._picked) this.startTimer();
    else this.stopTimer();
    this.saveSession();
  },

  // 本地 pendingSession（24h）优先，其次服务端 /api/practice/resume；都没有则按上次模块开练
  async tryResume(explicit: boolean) {
    const local = readPendingSession();
    if (local) {
      if (explicit) {
        this.adoptPending(local);
        return;
      }
      const done = local.items.filter((q) => q._picked).length;
      if (done === 0) {
        this.adoptPending(local);
        return;
      }
      wx.showModal({
        title: '继续上次练习？',
        content:
          (local.ptitle ? '「' + local.ptitle + '」' : '') +
          '上次还有一组未做完（' + done + '/' + local.items.length + ' 题），是否继续？',
        confirmText: '继续',
        cancelText: '不用了',
        success: (res) => {
          if (res.confirm) this.adoptPending(local);
          else {
            wx.removeStorageSync(PENDING_KEY);
            this.clearServerProgress();
            this.startFallback(local.lastModule);
          }
        },
      });
      return;
    }
    try {
      const d = await fetchPracticeResume();
      const snap = adoptPracticeResume(d);
      const clearedAt = Number(wx.getStorageSync(PP_CLEARED_KEY) || 0);
      if (snap && Date.now() - clearedAt > 60 * 1000) {
        this._module = snap.module || null;
        this._submodule = snap.submodule || null;
        this._source = snap.source || null;
        this._ptitle = snap.ptitle;
        this.setData({ moduleName: modName(snap.module || ''), navTitle: snap.ptitle || modName(snap.module || '') + ' · 续做' });
        this.adopt(snap.items.map(toPQ), snap.idx, snap.right, snap.streak, snap.bestStreak);
        wx.showToast({ title: '已恢复上次进度', icon: 'none' });
        return;
      }
    } catch (e) {
      /* 服务端无进度或网络失败：走新开 */
    }
    if (explicit) wx.showToast({ title: '没有可续做的练习，已重新开始', icon: 'none' });
    this.startFallback('');
  },
  adoptPending(s: PendingSession) {
    this._module = s.lastModule || null;
    this._submodule = s.lastSubmodule || null;
    this._source = s.source || null;
    this._ptitle = s.ptitle || '';
    this.setData({ moduleName: modName(s.lastModule || ''), navTitle: s.ptitle || modName(s.lastModule || '') + ' · 续做' });
    this.adopt(s.items.map(toPQ), s.idx, s.right, s.streak, s.bestStreak);
  },
  startFallback(module: string) {
    const a = this._args as LaunchArgs;
    this.start({ ...a, module: module || String(wx.getStorageSync('lastModule') || '') || null, source: a.source || 'direct' });
  },

  // ---------- 进度持久化（本地 + 服务端） ----------

  saveSession() {
    const { items, idx, right, streak } = this.data;
    if (!items.length || this.data.finished) return;
    const s: PendingSession = {
      t: Date.now(),
      items: items.map((q) => ({ ...q, optList: undefined }) as ProgressQuestion),
      idx,
      right,
      streak,
      bestStreak: this._bestStreak,
      lastModule: this._module || '',
      lastSubmodule: this._submodule || '',
      source: this._source || '',
      ptitle: this._ptitle,
    };
    try {
      wx.setStorageSync(PENDING_KEY, s);
    } catch (e) {
      /* storage 满：仅服务端 */
    }
    if (this._progressTimer) clearTimeout(this._progressTimer as ReturnType<typeof setTimeout>);
    this._progressTimer = setTimeout(() => this.flushProgress(), 1500);
  },
  flushProgress() {
    if (this._progressTimer) {
      clearTimeout(this._progressTimer as ReturnType<typeof setTimeout>);
      this._progressTimer = 0;
    }
    if (this.data.finished || this.data.offline || !this.data.items.length) return;
    const p = collectPracticeProgress(
      this.data.items,
      this.data.idx,
      this.data.right,
      this.data.streak,
      this._bestStreak,
      this._module || '',
      this._submodule || '',
      this._source || '',
      this._ptitle
    );
    if (p) postPracticeProgress(p).catch(() => {});
  },
  clearServerProgress() {
    wx.setStorageSync(PP_CLEARED_KEY, Date.now());
    postPracticeProgress({ qids: [] }).catch(() => {});
  },

  // ---------- 计时 ----------

  startTimer() {
    this.stopTimer();
    this._qsecs = 0;
    this.setData({ timerText: this.timerLabel(0), overtime: false });
    this._timer = setInterval(() => {
      this._qsecs++;
      const over = this.data.timedMode && !this.data.beiMode && this._qsecs > this.data.targetSecs;
      this.setData({ timerText: this.timerLabel(this._qsecs), overtime: over });
      if (over && this._qsecs === this.data.targetSecs + 1) {
        wx.showToast({ title: '超时了，考场上建议果断猜选跳过', icon: 'none' });
      }
    }, 1000);
  },
  timerLabel(secs: number): string {
    if (!this.data.timedMode || this.data.beiMode) return fmtSecs(secs);
    const t = this.data.targetSecs;
    return secs > t ? '超时+' + fmtSecs(secs - t) : fmtSecs(t - secs);
  },
  stopTimer() {
    if (this._timer) {
      clearInterval(this._timer as ReturnType<typeof setInterval>);
      this._timer = 0;
    }
  },
  clearAutoTimer() {
    if (this._autoTimer) {
      clearTimeout(this._autoTimer as ReturnType<typeof setTimeout>);
      this._autoTimer = 0;
    }
  },

  // ---------- 字号 / 设置 ----------

  applyFont(lv: number) {
    this.setData({ fontLv: lv, fontLabel: FONT_LABELS[lv], qFs: Q_FS[lv], optFs: OPT_FS[lv], expFs: EXP_FS[lv] });
  },
  onPreviewImg() {
    const url = this.data.curImg;
    if (url) wx.previewImage({ urls: [url] });
  },
  onCycleFont() {
    const lv = (this.data.fontLv + 1) % 3;
    this.applyFont(lv);
    wx.setStorageSync('fontLv', lv);
    wx.showToast({ title: '字号：' + FONT_LABELS[lv], icon: 'none', duration: 800 });
  },
  onOpenTools() {
    this.setData({ toolsOpen: true });
  },
  onCloseTools() {
    this.setData({ toolsOpen: false });
  },
  onToggleBei() {
    const on = !this.data.beiMode;
    wx.setStorageSync('beiMode', on ? '1' : '');
    this.setData({ beiMode: on, timerText: this.timerLabel(this._qsecs) });
    wx.showToast({ title: on ? '背题模式：直接显示答案与解析，不计分' : '已切回做题模式', icon: 'none' });
  },
  onToggleAutoNext() {
    const on = !this.data.autoNext;
    wx.setStorageSync('autoNextOff', on ? '' : '1');
    this.setData({ autoNext: on });
    savePracticePref('auto_next', on).catch(() => {});
    wx.showToast({ title: on ? '答对后 1.2 秒自动跳下一题' : '已关闭自动跳题', icon: 'none' });
  },
  onToggleTimed() {
    const on = !this.data.timedMode;
    wx.setStorageSync('timedMode', on ? '1' : '');
    this.setData({ timedMode: on });
    this.setData({ timerText: this.timerLabel(this._qsecs), overtime: on && this._qsecs > this.data.targetSecs });
    savePracticePref('timed_mode', on).catch(() => {});
    wx.showToast({ title: on ? '限时训练开启：按考场建议用时倒计时' : '已关闭限时训练', icon: 'none', duration: 1500 });
  },
  onToggleVibrate() {
    const on = !this.data.vibrate;
    wx.setStorageSync('vibrateOff', on ? '' : '1');
    this.setData({ vibrate: on });
  },

  // ---------- 公告 ----------

  async loadAnnounce() {
    try {
      const d = await fetchAnnouncement();
      const item = d.item;
      if (item && String(wx.getStorageSync('annDismissed')) !== String(item.id)) this.setData({ announce: item });
    } catch (e) {
      /* 非关键路径 */
    }
  },
  onAnnDetail() {
    const a = this.data.announce;
    if (!a || !a.body) return;
    wx.showModal({ title: a.title, content: a.body, showCancel: false, confirmText: '知道了' });
  },
  onDismissAnn() {
    const a = this.data.announce;
    if (a) wx.setStorageSync('annDismissed', String(a.id));
    this.setData({ announce: null });
  },
  onGoSearch() {
    wx.navigateTo({ url: '/pkgLearn/search/search' });
  },

  // ---------- 作答 ----------

  onPick(e: WechatMiniprogram.TouchEvent) {
    if (this.data.picked || this.data.beiMode) return;
    const k = String(e.currentTarget.dataset.key);
    const cur = this.data.cur;
    if (!cur || cur._excl.includes(k)) return;
    cur._picked = k;
    cur._secs = this._qsecs;
    this.stopTimer();
    const correct = k === cur.answer;
    const right = this.data.right + (correct ? 1 : 0);
    const streak = correct ? this.data.streak + 1 : 0;
    this._bestStreak = Math.max(this._bestStreak, streak);
    this.setData({
      picked: k,
      right,
      streak,
      cur,
      [`items[${this.data.idx}]._picked`]: k,
      [`items[${this.data.idx}]._secs`]: cur._secs,
      wrongCount: this.data.wrongCount + (correct ? 0 : 1),
      answeredCount: this.data.answeredCount + 1,
    });
    this.refreshCardCells();
    recordStat(cur.module, correct, cur.submodule);
    this.checkBadgeMilestone();
    this.logAttempts([cur]);
    if (!correct) this.saveWrong(cur, k);
    if (this.data.vibrate) {
      try {
        wx.vibrateShort({ type: correct ? 'light' : 'medium' });
      } catch (err) {
        /* 不支持则忽略 */
      }
    }
    this.saveSession();
    if (correct && this.data.autoNext) {
      this.clearAutoTimer();
      this._autoTimer = setTimeout(() => {
        this._autoTimer = 0;
        if (this.data.cur === cur && this.data.picked) this.onNext();
      }, 1200);
    }
  },
  // 长按选项 = 排除法标记（H5 kg-option-group exclude）
  onExclOpt(e: WechatMiniprogram.TouchEvent) {
    if (this.data.picked) return;
    const k = String(e.currentTarget.dataset.key);
    const cur = this.data.cur;
    if (!cur) return;
    const excl = cur._excl.includes(k) ? cur._excl.filter((x) => x !== k) : [...cur._excl, k].slice(0, 3);
    cur._excl = excl;
    cur.optList = optListOf(cur.options, excl);
    this.setData({ cur, [`items[${this.data.idx}]._excl`]: excl });
    this.saveSession();
  },
  onStayHere() {
    this.clearAutoTimer();
    trackEvent('practice_stay_here', this._source || 'practice');
  },

  // answer_log 上报：先标记 _logged 再发请求，避免在途并发重复落库；失败入离线队列（对齐 practice.vue）
  async logAttempts(qs: PQuestion[]) {
    if (this.data.beiMode) return;
    try {
      const uid = anonUid();
      const pending = qs.filter((q) => q._picked && !q._logged);
      const items: AnswerLogItem[] = pending.map((q) => ({
        qid: q.id || null,
        mid: q.mistake_id || q.due_mid || undefined,
        module: q.module || this._module || null,
        submodule: q.submodule || null,
        correct: q._picked === q.answer,
        secs: q._secs || 0,
        picked: q._picked,
        source: this._source || null,
        t: Date.now(),
      }));
      if (items.length) {
        pending.forEach((q) => {
          q._logged = true;
        });
        const p = postAnswerLog(items);
        this._logPending.push(p);
        try {
          const r = await p;
          if (r && Array.isArray(r.reviewed) && r.reviewed.length) {
            this._reviewed = this._reviewed.concat(r.reviewed);
          }
        } catch (err) {
          enqueueAnswers(uid, items);
        }
      }
    } catch (e) {
      /* 非关键路径 */
    }
  },

  // 复习推进由 /api/answer_log 服务端统一完成；这里只等在途落库请求回来，汇总效果报告（practice.vue syncRedoReviews 同口径）
  async syncRedoReviews(items: PQuestion[]) {
    try {
      await Promise.all(this._logPending.map((p) => p.catch(() => null)));
    } catch (e) {
      /* 非关键路径 */
    }
    this._logPending = [];
    const reviewed = this._reviewed;
    this._reviewed = [];
    const mode = this._args ? this._args.mode : '';
    const redoReport = mode === 'redo' || mode === 'redoset' ? redoReportOf(items, reviewed) : null;
    const fixReport = redoReport ? null : fixReportOf(reviewed);
    this.setData({
      redoReport,
      redoTip: redoReportTip(redoReport),
      fixReport,
      fixText: fixReportText(fixReport),
    });
  },

  async saveWrong(q: PQuestion, picked: string) {
    if (q._saved) return;
    q._saved = true;
    const optText = q.optList.map((o) => `${o.k}.${o.v}`).join(' ');
    const m = {
      question_id: q.id || null,
      module: q.module,
      question_type: q.question_type || q.submodule,
      question_text: q.question + '\n' + optText,
      user_answer: picked,
      correct_answer: q.answer,
      explanation: q.explanation || '',
    };
    try {
      const r = await postMistake(m);
      q._mid = r.id;
      if (q._reason) patchMistakeReason(r.id, q._reason).catch(() => {});
    } catch (e) {
      enqueueMistake({ uid: anonUid(), ...m });
    }
  },
  // 错因自评（答错后）；错题已落库则 PATCH error_reason
  onSetReason(e: WechatMiniprogram.TouchEvent) {
    const rz = String(e.currentTarget.dataset.rz || '');
    const cur = this.data.cur;
    if (!cur || !rz) return;
    const next = cur._reason === rz ? '' : rz;
    cur._reason = next;
    this.setData({ 'cur._reason': next });
    if (cur._mid) patchMistakeReason(cur._mid, next).catch(() => {});
  },

  // ---------- 导航（下一题 / 答题卡） ----------

  goto(next: number) {
    const { items } = this.data;
    const q = items[next];
    if (!q) return;
    this.clearAutoTimer();
    this.setData({
      idx: next,
      cur: q,
      curImg: imgUrl(q.image),
      curStat: qStatLine(q),
      curKp: kpChain(q, modName(q.module)),
      curSource: sourceLabel(q),
      picked: q._picked || '',
      targetSecs: TARGET_SECS[q.module] || 60,
      hsRated: '',
      cardOpen: false,
    });
    this.refreshCardCells();
    this.loadSocial(q);
    if (!q._picked) this.startTimer();
    else this.stopTimer();
    this.saveSession();
  },
  onNext() {
    const { idx, items } = this.data;
    if (idx + 1 < items.length) {
      this.goto(idx + 1);
      return;
    }
    this.finish();
  },
  onPrev() {
    if (this.data.idx > 0) this.goto(this.data.idx - 1);
  },
  onOpenCard() {
    this.refreshCardCells();
    this.setData({ cardOpen: true });
  },
  onCloseCard() {
    this.setData({ cardOpen: false });
  },
  onJumpTo(e: WechatMiniprogram.TouchEvent) {
    const i = Number(e.currentTarget.dataset.i);
    if (Number.isInteger(i)) this.goto(i);
  },
  refreshCardCells() {
    const { items, idx, beiMode } = this.data;
    this.setData({
      cardCells: items.map((q, i) => ({
        i,
        cls: i === idx ? 'cur' : !q._picked ? '' : beiMode ? 'seen' : q._picked === q.answer ? 'ok' : 'bad',
      })),
    });
  },

  async finish() {
    this.stopTimer();
    this.clearAutoTimer();
    const { items, right, beiMode } = this.data;
    const totalSecs = items.reduce((s, q) => s + (q._secs || 0), 0);
    const wrongN = items.filter((q) => q._picked && q._picked !== q.answer).length;
    this.setData({
      finished: true,
      cur: null,
      curImg: '',
      curStat: '',
      curKp: '',
      curSource: '',
      pct: Math.round((right / items.length) * 100),
      totalSecs,
      wrongCount: wrongN,
      doneBar: doneBarPlan(wrongN, beiMode, this.data.backLabel),
      dueReview: 0,
      cardOpen: false,
      toolsOpen: false,
    });
    wx.removeStorageSync(PENDING_KEY);
    this.clearServerProgress();
    if (beiMode) return;
    await this.logAttempts(items);
    await this.syncRedoReviews(items);
    this.loadDueReview();
    if (!this._resultSent) {
      this._resultSent = true;
      try {
        const d = await postPracticeResult(this._module || '', items.length, right, totalSecs);
        if (d.percentile != null) this.setData({ percentile: d.percentile });
      } catch (e) {
        /* 非关键路径 */
      }
    }
  },
  // 结算态：只重练本组答错的题
  onRedoWrong() {
    const wrong = this.data.items.filter((q) => q._picked && q._picked !== q.answer);
    if (!wrong.length) return;
    wx.setStorageSync(
      'redoSet',
      wrong.map((q) => ({ ...q, _picked: '', _secs: 0, _logged: false, _excl: [], optList: undefined }))
    );
    const a = this._args as LaunchArgs;
    this.start({ ...a, mode: 'redoset', count: wrong.length, ptitle: '本组错题重练', skipped: 0 });
  },

  // ---------- 每题社交态：收藏 / 笔记 / 讨论计数 ----------

  async loadSocial(q: PQuestion) {
    const seq = ++this._favSeq;
    this.setData({ isFav: false, favNote: '', commentN: 0 });
    if (!q.id || this.data.offline) return;
    fetchFavStatus(q.id)
      .then((s) => {
        if (seq === this._favSeq) this.setData({ isFav: !!s.faved });
      })
      .catch(() => {});
    fetchNote(q.id)
      .then((n) => {
        if (seq === this._favSeq) this.setData({ favNote: (n.item && n.item.content) || '' });
      })
      .catch(() => {});
    fetchCommentCount(q.id)
      .then((c) => {
        if (seq === this._favSeq) this.setData({ commentN: c.total || 0 });
      })
      .catch(() => {});
  },
  onToggleFav() {
    const q = this.data.cur;
    if (!q || !q.id) return;
    const on = !this.data.isFav;
    this.setData({ isFav: on });
    (on ? setFav(q.id) : deleteFav(q.id)).catch(() => this.setData({ isFav: !on }));
    wx.showToast({ title: on ? '已收藏，可在错题本查看' : '已取消收藏', icon: 'none', duration: 900 });
  },
  onOpenNote() {
    this.setData({ noteOpen: true, noteDraft: this.data.favNote });
  },
  onCloseNote() {
    this.setData({ noteOpen: false });
  },
  onNoteInput(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ noteDraft: String(e.detail.value || '').slice(0, 500) });
  },
  async onSaveNote() {
    const q = this.data.cur;
    if (!q || !q.id || this.data.noteBusy) return;
    this.setData({ noteBusy: true });
    try {
      await saveNote(q.id, this.data.noteDraft.trim());
      this.setData({ favNote: this.data.noteDraft.trim(), noteOpen: false });
      wx.showToast({ title: '笔记已保存', icon: 'none' });
    } catch (e) {
      wx.showToast({ title: '保存失败：' + (e as Error).message, icon: 'none' });
    } finally {
      this.setData({ noteBusy: false });
    }
  },
  onOpenDiscuss() {
    const q = this.data.cur;
    if (!q || !q.id) return;
    wx.navigateTo({
      url: DISCUSS_URL + q.id,
      fail: () => wx.showToast({ title: '讨论区即将上线', icon: 'none' }),
    });
  },

  // ---------- 讲解区：花生十三评分 / AI 详解 ----------

  async onRateHs(e: WechatMiniprogram.TouchEvent) {
    const up = e.currentTarget.dataset.up === '1';
    const q = this.data.cur;
    if (!q || !q.id || this.data.hsRated) return;
    this.setData({ hsRated: up ? 'up' : 'down' });
    try {
      await rateExplanation(q.id, up);
    } catch (err) {
      /* 静默失败 */
    }
    wx.showToast({ title: up ? '感谢反馈' : '已记录，我们会核查这条解析', icon: 'none' });
  },
  onDeepExplain() {
    const q = this.data.cur;
    if (!q) return;
    openExplain({
      text: askPrefill(q.question, q.options),
      qid: q.id || null,
      answer: this.data.picked || '',
    });
  },

  // ---------- 题目纠错 ----------

  onOpenReport() {
    if (!this.data.cur) return;
    this.setData({ reportOpen: true, reportType: '', reportDetail: '' });
  },
  onCloseReport() {
    this.setData({ reportOpen: false });
  },
  onReportType(e: WechatMiniprogram.TouchEvent) {
    this.setData({ reportType: String(e.currentTarget.dataset.t || '') });
  },
  onReportDetail(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ reportDetail: String(e.detail.value || '').slice(0, 500) });
  },
  async onSubmitReport() {
    const q = this.data.cur;
    if (!q || !q.id || !this.data.reportType || this.data.reportBusy) return;
    this.setData({ reportBusy: true });
    try {
      await postQuestionReport(q.id, this.data.reportType, this.data.reportDetail);
      q._reported = true;
      this.setData({ reportOpen: false, 'cur._reported': true });
      wx.showToast({ title: '感谢反馈，我们会尽快核查', icon: 'none' });
    } catch (e) {
      wx.showToast({ title: '提交失败：' + (e as Error).message, icon: 'none' });
    } finally {
      this.setData({ reportBusy: false });
    }
  },

  // ---------- 徽章 / 分享 / 复习提醒 ----------

  // 本地连击只做「疑似达标」预检；解锁与展示以服务端 /api/checkin/badges 的 streak 为准
  async checkBadgeMilestone() {
    const localStreak = streakDays();
    const seen = Number(wx.getStorageSync('badgeSeenMax') || 0);
    if (!BADGE_MILESTONES.some((m) => localStreak >= m && m > seen) || this._badgeChecking) return;
    this._badgeChecking = true;
    try {
      const b = await fetchCheckinBadges();
      const srvStreak = b.streak || 0;
      const hit = BADGE_MILESTONES.filter(
        (m) => srvStreak >= m && m > seen && (b.badges || []).some((x) => x.days === m && x.unlocked)
      ).pop();
      if (hit) {
        wx.setStorageSync('badgeSeenMax', hit);
        trackEvent('badge_unlock', 'badge', String(hit));
        wx.showModal({
          title: '🏅 解锁新徽章！',
          content: `连续打卡 ${srvStreak} 天，解锁 ${hit} 天徽章，坚持就是实力。生成专属海报，晒给考友看？`,
          confirmText: '生成海报',
          cancelText: '稍后再看',
          success: (r) => {
            if (r.confirm) wx.navigateTo({ url: '/pages/social/poster?badge=' + hit });
          },
        });
      }
    } catch (e) {
      /* 非关键路径 */
    }
    this._badgeChecking = false;
  },

  async onShareQ() {
    const cur = this.data.cur;
    if (!cur || !cur.id) {
      wx.showToast({ title: '该题暂不支持分享', icon: 'none' });
      return;
    }
    try {
      const d = await shareCreate(cur.id);
      const mod = d.submodule || modName(d.module || '');
      this._shareSid = d.sid;
      this._shareTitle = `我考你一道${mod}题，你能做对吗？`;
      trackEvent('share_copy', 'share_q', d.sid);
      wx.setClipboardData({
        data: `【${mod}】我刚在错题邦做了一道题，你能做对吗？答完就能看到大家选了啥：https://kaogong.zalize.com/s/${d.sid}`,
        success: () => wx.showToast({ title: '链接已复制，也可点右上角转发给队友', icon: 'none' }),
      });
    } catch (e) {
      wx.showToast({ title: (e as Error).message || '分享失败', icon: 'none' });
    }
  },

  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    if (this._shareSid) {
      return { title: this._shareTitle, path: `/pages/share/share?sid=${this._shareSid}` };
    }
    return { title: '一起来刷题' };
  },

  async loadDueReview() {
    try {
      const r = await fetchReviewDue();
      this.setData({ dueReview: r.total || (r.items || []).length });
    } catch (e) {
      /* 非关键路径 */
    }
  },
  onGoReview() {
    trackEvent('review_entry_click', 'practice_done');
    wx.setStorageSync('autoStartReview', 1);
    wx.switchTab({ url: '/pages/book/book' });
  },
  onRetry() {
    const a = (this._groupArgs || this._args) as LaunchArgs;
    this.start({ ...a, mode: a.mode === 'redoset' ? '' : a.mode });
  },
  runDoneAct(act: DoneAct) {
    if (act === 'redo') this.onRedoWrong();
    else if (act === 'retry') this.onRetry();
    else this.onQuit();
  },
  onDonePrimary() {
    this.runDoneAct(this.data.doneBar.primaryAct);
  },
  onDoneSecondary() {
    this.runDoneAct(this.data.doneBar.secondaryAct);
  },
  onQuit() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/home' }) });
  },
});
