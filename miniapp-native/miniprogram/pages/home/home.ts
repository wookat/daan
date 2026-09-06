import { fetchCheckinBadges, fetchCheckinSummary, fetchProfile, fetchQuestionCounts, saveProfile, trackEvent } from '../../api/index';
import type { CheckinBadgesResp, CheckinSummaryResp, Profile } from '../../api/types';
import {
  adoptServerDailyGoal,
  fetchDailyPlan,
  fetchDailySet,
  fetchHomeBundle,
  fetchPlanTodayFull,
  flushDailySubmit,
  loadDailyDone,
  loadSzDaily,
  saveServerDailyGoal,
  setUserFocus,
} from '../../api/grow';
import type { DailyDoneRec, DailyPlanResp, HomeBundleResp, HomeProfile, PlanTodayResp, PlanTodayTask } from '../../api/grow';
import { fetchAnnouncement, fetchPracticeResume, fetchReviewCur, postPracticeProgress, saveReviewCur } from '../../api/learn';
import type { Announcement } from '../../api/learn';
import { anonUid } from '../../utils/auth';
import { examResume, examProgressDrop } from '../../api/exam';
import { type ResumeInfo, resolveResume, dropResume, resumeUrl } from '../../utils/kg-exam-progress';
import { fmtClock } from '../../utils/kg-exam-timer';
import { MODULE_KEYS, moduleMeta } from '../../utils/module-meta';
import { cnDayKey } from '../../utils/cn-date';
import {
  PENDING_KEY,
  PP_CLEARED_KEY,
  parsePendingPractice,
  parseRemotePractice,
  readPendingSession,
  type ResumeBrief,
} from '../../utils/practice-progress';
import { parseReviewSnap, REVIEW_SNAP_KEY, type ReviewResume } from '../../utils/review-snap';
import { getDailyGoal, modName, setDailyGoal, streakDays, todayCount } from '../../utils/stats';
import { syncTabBar } from '../../utils/tabbar';

interface ModCard {
  key: string;
  name: string;
  icon: string;
  color: string;
  soft: string;
  count: string;
}

// count 为静态回退（口径同生产 2026-08 /api/question_counts），接口成功后由 fmtCount 实时覆盖；
// 颜色/图标取 utils/module-meta（语义 token，随深色模式切换）
function modCard(key: string, count: string): ModCard {
  const m = moduleMeta(key);
  return { key, name: m.label, icon: m.icon, color: m.color, soft: m.soft, count };
}
const MODS: ModCard[] = [
  modCard('ziliao', '4,600+ 题'),
  modCard('shuliang', '3.3 万题'),
  modCard('yanyu', '1.8 万题'),
  modCard('panduan', '2.3 万题'),
  modCard('changshi', '3.1 万题'),
  { key: '', name: '全模块混练', icon: 'shuffle', color: 'var(--brand)', soft: 'var(--brand-soft)', count: '10 万+ 题' },
];

const toOpts = (xs: Array<string | number>, suffix = ''): Array<{ value: string | number; label: string }> =>
  xs.map((x) => ({ value: x, label: String(x) + suffix }));

function fmtCount(n: number, total = false): string {
  if (total) return Math.floor(n / 10000) + ' 万+ 题';
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + ' 万题';
  const k = Math.floor(n / 100) * 100;
  return k.toLocaleString('en-US') + '+ 题';
}

function applyCounts(mods: ModCard[], counts: { module: string; n: number }[]): ModCard[] {
  const byMod: Record<string, number> = {};
  let total = 0;
  for (const c of counts) {
    byMod[c.module] = c.n;
    total += c.n;
  }
  return mods.map((m) => {
    if (!m.key) return total ? { ...m, count: fmtCount(total, true) } : m;
    return byMod[m.key] ? { ...m, count: fmtCount(byMod[m.key]) } : m;
  });
}

const BUNDLE_SNAP_KEY = 'homeBundleSnap';

interface PlanTaskView extends PlanTodayTask {
  goText: string;
  subText: string;
  icon: string;
  iconTone: string;
}

interface WeakView {
  key: string;
  module: string;
  submodule: string;
  tag3: string | null;
  text: string;
}

function planTaskView(t: PlanTodayTask): PlanTaskView {
  const goText = t.done
    ? '已完成'
    : t.type === 'mock'
      ? '去模考 ›'
      : t.type === 'review'
        ? '去复习 ›'
        : t.type === 'reinforce'
          ? '去强化 ›'
          : '去练 ›';
  const subText = (t.sub || '') + (t.type !== 'mock' && t.done_n ? ' · 已完成 ' + t.done_n + '/' + t.target : '');
  return { ...t, goText, subText, icon: t.done ? 'circle-check' : 'target', iconTone: t.done ? 'ok' : 'brand' };
}

Page({
  data: {
    today: 0,
    goal: 20,
    goalPct: 0,
    streak: 0,
    mods: MODS,
    goalChips: [20, 50, 100],
    planOpen: false,
    // 练习方式 4 格：只放去处（真题 / 模考 / 申论 / 拍题讲解），数据类信息不进格
    quick: [
      { key: 'real', icon: 'file-text', label: '真题模式' },
      { key: 'exam', icon: 'timer', label: '模考' },
      { key: 'shenlun', icon: 'pen-line', label: '申论' },
      { key: 'ask', icon: 'camera', label: '拍题讲解' },
    ],
    hasProfile: false,
    planLoaded: false,
    guideHide: false,
    setupOpen: false,
    setupStep: 1,
    setupBusy: false,
    pf: {
      exam_type: '国考',
      target_region: '',
      exam_date: '',
      target_score: 70,
      daily_minutes: 60,
      base_level: '零基础',
    } as Profile,
    examTypeOpts: toOpts(['国考', '省考', '事业单位', '其他']),
    scoreOpts: toOpts([60, 65, 70, 75, 80], '+'),
    baseLevelOpts: toOpts(['零基础', '有基础', '二战']),
    minuteOpts: toOpts([30, 60, 90, 120], ' 分钟'),
    dateStart: '',
    dateEnd: '',
    // 学习计划（/api/plan/today，有画像时）
    planTasks: [] as PlanTaskView[],
    planDone: 0,
    planTotal: 0,
    daysLeft: null as number | null,
    phaseName: '',
    realMode: false,
    // 今日建议（/api/daily_plan，无画像时）
    weakList: [] as WeakView[],
    yesterdayText: '',
    showSuggest: false,
    focus: '',
    focusOpts: MODULE_KEYS.map((k) => ({ value: k, label: moduleMeta(k).label })),
    dueReview: 0,
    dueLoaded: false,
    clearedToday: 0,
    badgeStreak: 0,
    nextMilestone: null as { days: number; left: number; pct: number } | null,
    taskDoneN: 0,
    // 公告 / 续练续考（H5 resumes：本地 pendingSession/reviewSnap 优先，其次服务端） / 全站同题 / 时政 / 周报
    announce: null as Announcement | null,
    examResume: null as (ResumeInfo & { leftText: string }) | null,
    practiceResume: null as (ResumeBrief & { name: string }) | null,
    reviewResume: null as ReviewResume | null,
    dsMeta: null as { date: string; participants: number } | null,
    dsDone: null as DailyDoneRec | null,
    dsDoneText: '',
    szTodayDone: false,
    weeklyDot: false,
  },
  _serverToday: null as number | null,
  _profile: null as HomeProfile | null,
  onLoad() {
    const d = new Date();
    const fmt = (x: Date) =>
      x.getFullYear() +
      '-' +
      String(x.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(x.getDate()).padStart(2, '0');
    this.setData({
      guideHide: !!wx.getStorageSync('planGuideHide'),
      dateStart: fmt(d),
      dateEnd: fmt(new Date(d.getFullYear() + 2, d.getMonth(), d.getDate())),
    });
    this.loadCounts();
  },
  // 题数与 H5 首页同源 /api/question_counts，失败保持静态回退
  async loadCounts() {
    try {
      const d = await fetchQuestionCounts();
      if (d.counts && d.counts.length) this.setData({ mods: applyCounts(MODS, d.counts) });
    } catch (e) {
      /* 非关键路径 */
    }
  },
  onShow() {
    syncTabBar(this, 0);
    this.refreshGoal();
    this.loadHome();
    this.loadAnnounce();
    this.calcWeeklyDot();
    this.loadExamResume();
    this.loadPracticeResume();
    this.loadReviewResume();
    this.loadDailySet();
    this.setData({ szTodayDone: !!loadSzDaily().days[cnDayKey()] });
    flushDailySubmit(cnDayKey());
  },
  onSearch() {
    wx.navigateTo({ url: '/pkgLearn/search/search' });
  },
  // ---------- 续做卡（H5 loadPracticeResume/prContinue/prDrop） ----------
  loadPracticeResume() {
    const brief = (b: ResumeBrief | null) => (b ? { ...b, name: b.ptitle || modName(b.module) || '上次练习' } : null);
    const local = parsePendingPractice(readPendingSession(), Date.now());
    if (local) {
      this.setData({ practiceResume: brief(local) });
      return;
    }
    this.setData({ practiceResume: null });
    const clearedAt = Number(wx.getStorageSync(PP_CLEARED_KEY)) || 0;
    if (clearedAt && Date.now() - clearedAt < 30 * 1000) return;
    fetchPracticeResume()
      .then((d) => this.setData({ practiceResume: brief(parseRemotePractice(d)) }))
      .catch(() => {});
  },
  onPrContinue() {
    wx.navigateTo({ url: '/pages/practice/practice?resume=1' });
  },
  onPrDrop() {
    wx.showModal({
      title: '放弃未完成练习？',
      content: '放弃后这组题的作答进度不再保留',
      confirmText: '放弃',
      cancelText: '再想想',
      success: (res) => {
        if (!res.confirm) return;
        wx.removeStorageSync(PENDING_KEY);
        wx.setStorageSync(PP_CLEARED_KEY, Date.now());
        postPracticeProgress({ qids: [] }).catch(() => {});
        this.setData({ practiceResume: null });
      },
    });
  },
  loadReviewResume() {
    const uid = anonUid();
    const local = parseReviewSnap(wx.getStorageSync(REVIEW_SNAP_KEY), uid, Date.now() / 1000);
    if (local) {
      this.setData({ reviewResume: local });
      return;
    }
    this.setData({ reviewResume: null });
    const clearedAt = Number(wx.getStorageSync('rvClearedAt')) || 0;
    if (clearedAt && Date.now() - clearedAt < 30 * 1000) return;
    fetchReviewCur()
      .then((r) => this.setData({ reviewResume: parseReviewSnap(r && r.snap, uid, Date.now() / 1000) }))
      .catch(() => {});
  },
  onRvContinue() {
    trackEvent('home_review_resume_click', 'home');
    wx.setStorageSync('bookReviewIntent', 1);
    wx.switchTab({ url: '/pages/book/book' });
  },
  onRvDrop() {
    wx.showModal({
      title: '放弃未完成复习？',
      content: '放弃后这轮复习的进度不再保留',
      confirmText: '放弃',
      cancelText: '再想想',
      success: (res) => {
        if (!res.confirm) return;
        wx.removeStorageSync(REVIEW_SNAP_KEY);
        wx.setStorageSync('rvClearedAt', Date.now());
        saveReviewCur(null).catch(() => {});
        this.setData({ reviewResume: null });
      },
    });
  },
  // 未交卷模考续考卡（与 H5 首页 examResume 同源：本机 examProgress 优先，否则 /api/exam/resume）
  async loadExamResume() {
    const r = await resolveResume(examResume);
    this.setData({ examResume: r ? { ...r, leftText: fmtClock(r.leftSecs) } : null });
  },
  onErContinue() {
    const r = this.data.examResume;
    if (r) wx.navigateTo({ url: resumeUrl(r) });
  },
  onErDrop() {
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
  onGoExamList() {
    wx.navigateTo({ url: '/pkgExam/list/list' });
  },
  onGoShenlun() {
    wx.navigateTo({ url: '/pkgExam/shenlun/shenlun' });
  },
  // 首屏 uid 专属数据聚合拉取：bundle 一次取齐 plan/profile/plan_today/badges/summary（同 H5 loadHome），
  // 失败时回退逐个端点；本地快照先渲染但不套用 summary（避免今日已练回退旧值）
  async loadHome() {
    const snap = wx.getStorageSync<HomeBundleResp | ''>(BUNDLE_SNAP_KEY);
    if (snap) this.applyBundle(snap, true);
    try {
      const d = await fetchHomeBundle();
      wx.setStorageSync(BUNDLE_SNAP_KEY, d);
      this.applyBundle(d, false);
    } catch (e) {
      this.loadPlanFallback();
      this.loadBadges();
      this.loadTodayServer();
      this.loadProfileFallback();
    }
  },
  applyBundle(d: HomeBundleResp, stale: boolean) {
    this.applyPlan(d.plan);
    if (d.badges) this.applyBadges(d.badges);
    if (!stale && d.summary) this.applySummary(d.summary);
    this.applyProfile(d.profile || null, d.profile ? d.plan_today : null);
  },
  applyPlan(plan: DailyPlanResp | null) {
    if (!plan) return;
    const weakList: WeakView[] = (plan.weak || []).map((w) => ({
      key: w.module + '|' + w.submodule + '|' + (w.tag3 || ''),
      module: w.module || '',
      submodule: w.submodule,
      tag3: w.tag3 || null,
      text: (w.label || w.submodule) + '（' + w.reason + ' · 正确率 ' + Math.round(w.acc * 100) + '%）',
    }));
    const y = plan.yesterday;
    const yesterdayText = y && y.n ? '昨日练 ' + y.n + ' 题 · 正确率 ' + Math.round((y.correct / y.n) * 100) + '%' : '昨日未练习';
    const due = plan.due_mistakes || 0;
    this.setData({
      dueReview: due,
      dueLoaded: true,
      weakList,
      yesterdayText,
      focus: plan.focus || '',
      showSuggest: !!(due || weakList.length || (y && y.n)),
    });
    this.updateTaskCard();
  },
  applyBadges(b: CheckinBadgesResp) {
    this.setData({ badgeStreak: b.streak, streak: b.streak });
    this.updateMilestone(
      b.streak,
      (b.badges || []).map((x) => x.days)
    );
  },
  applySummary(d: CheckinSummaryResp) {
    if (d.today_n == null) return;
    const today = d.today_n;
    this._serverToday = today;
    this.setData({
      today,
      clearedToday: d.cleared_today || 0,
      goalPct: Math.min(100, Math.round((today / this.data.goal) * 100)),
    });
    this.updateTaskCard();
  },
  applyProfile(profile: HomeProfile | null, planToday: PlanTodayResp | null) {
    this._profile = profile;
    const g = adoptServerDailyGoal(this.data.goal, profile);
    if (g != null) {
      setDailyGoal(g);
      this.refreshGoal();
    }
    if (profile) this.setData({ pf: { ...this.data.pf, ...profile } });
    this.applyPlanToday(profile ? planToday : null);
  },
  applyPlanToday(plan: PlanTodayResp | null) {
    if (!plan || !plan.profile) {
      this.setData({ hasProfile: false, planLoaded: true, planTasks: [] });
      return;
    }
    const tasks = (plan.tasks || []).map(planTaskView);
    const prog = plan.progress || { done: tasks.filter((t) => t.done).length, total: tasks.length };
    this.setData({
      hasProfile: true,
      planLoaded: true,
      planTasks: tasks,
      planDone: prog.done,
      planTotal: prog.total,
      daysLeft: plan.days_left ?? null,
      phaseName: plan.phase_name || '',
      realMode: !!plan.real_mode,
    });
  },
  // ---- bundle 失败时的逐端点回退（旧后端/部署窗口兼容）----
  async loadPlanFallback() {
    try {
      this.applyPlan(await fetchDailyPlan());
    } catch (e) {
      /* 非关键路径 */
    }
  },
  async loadProfileFallback() {
    try {
      const d = await fetchProfile();
      const profile = (d.profile || null) as HomeProfile | null;
      let planToday: PlanTodayResp | null = null;
      if (profile) planToday = await fetchPlanTodayFull();
      this.applyProfile(profile, planToday);
    } catch (e) {
      this.setData({ planLoaded: true });
    }
  },
  async loadTodayServer() {
    try {
      this.applySummary(await fetchCheckinSummary());
    } catch (e) {
      /* 非关键路径 */
    }
  },
  // 连签口径以服务端 /api/checkin/badges 为准（hero / 任务卡同源），失败降级本机 streak
  async loadBadges() {
    try {
      this.applyBadges(await fetchCheckinBadges());
    } catch (e) {
      this.updateMilestone(this.data.streak, [3, 7, 14, 30, 60, 100]);
    }
  },
  refreshGoal() {
    const today = this._serverToday ?? todayCount();
    const goal = getDailyGoal();
    this.setData({
      today,
      goal,
      goalPct: Math.min(100, Math.round((today / goal) * 100)),
      streak: this.data.badgeStreak || streakDays(),
    });
    this.updateTaskCard();
  },
  updateMilestone(streak: number, ms: number[]) {
    const next = ms.find((m) => m > streak);
    if (!next) {
      this.setData({ nextMilestone: null });
      return;
    }
    let prev = 0;
    for (const m of ms) {
      if (m <= streak) prev = m;
    }
    this.setData({
      nextMilestone: {
        days: next,
        left: next - streak,
        pct: Math.round(((streak - prev) / (next - prev)) * 100),
      },
    });
  },
  updateTaskCard() {
    let n = 0;
    if (this.data.today >= this.data.goal) n++;
    if (this.data.dueLoaded && !this.data.dueReview) n++;
    if (this.data.today > 0) n++;
    this.setData({ taskDoneN: n });
  },
  // ---- 公告 ----
  async loadAnnounce() {
    try {
      const d = await fetchAnnouncement();
      const item = d.item;
      this.setData({ announce: item && wx.getStorageSync('annDismissed') !== String(item.id) ? item : null });
    } catch (e) {
      this.setData({ announce: null });
    }
  },
  onDismissAnn() {
    if (this.data.announce) wx.setStorageSync('annDismissed', String(this.data.announce.id));
    this.setData({ announce: null });
  },
  // ---- 全站同题（每日一练）外显 ----
  loadDailySet() {
    fetchDailySet()
      .then((d) => {
        if (!d || !d.date || !(d.items || []).length) return;
        const done = loadDailyDone();
        const dsDone = done && done.date === d.date ? done : null;
        let dsDoneText = '';
        if (dsDone) {
          dsDoneText = '今日全站同题 · 答对 ' + dsDone.right + '/' + dsDone.total;
          if (dsDone.rank) dsDoneText += ' · 第 ' + dsDone.rank + ' 名';
          if (dsDone.streak >= 2) dsDoneText += ' · 连 ' + dsDone.streak + ' 天';
        } else {
          const n = (d.stats && d.stats.participants) || 0;
          dsDoneText = '今日全站同题 10 题 · ' + (n ? '已有 ' + n + ' 人完成' : '来做今天第 1 人');
        }
        this.setData({ dsMeta: { date: d.date, participants: (d.stats && d.stats.participants) || 0 }, dsDone, dsDoneText });
      })
      .catch(() => undefined);
  },
  onDailySet() {
    wx.navigateTo({ url: '/pkgGrow/daily/daily?kind=set' });
  },
  onDailyArchive() {
    wx.navigateTo({ url: '/pkgGrow/daily/daily?kind=set&archive=1' });
  },
  onShizheng() {
    wx.navigateTo({ url: '/pkgGrow/daily/daily?kind=shizheng' });
  },
  onSzArchive() {
    wx.navigateTo({ url: '/pkgGrow/daily/daily?kind=shizheng&archive=1' });
  },
  // 周一至周三未读上周周报时显示红点（同 H5 calcWeeklyDot）
  calcWeeklyDot() {
    const now = new Date();
    const dow = now.getDay();
    if (dow < 1 || dow > 3) {
      this.setData({ weeklyDot: false });
      return;
    }
    const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastWs = Math.floor(day0.getTime() / 1000) - ((dow + 6) % 7) * 86400 - 7 * 86400;
    this.setData({ weeklyDot: wx.getStorageSync('weeklyReadWs') !== lastWs });
  },
  onWeeklyReport() {
    wx.navigateTo({ url: '/pkgGrow/weekly-report/weekly-report' });
  },
  onCalendar() {
    wx.navigateTo({ url: '/pkgGrow/calendar/calendar' });
  },
  onAsk() {
    wx.navigateTo({ url: '/pkgSocial/ask/ask' });
  },
  onRealPractice() {
    wx.navigateTo({ url: '/pages/practice/practice?real=1&count=10' });
  },
  // ---- 任务卡 / 复习 / 目标 ----
  onTaskGo(e: WechatMiniprogram.TouchEvent) {
    const kind = String(e.currentTarget.dataset.kind || '');
    trackEvent('task_card_click', kind);
    if (kind === 'practice') {
      wx.navigateTo({ url: '/pages/practice/practice' });
    } else if (kind === 'review') {
      if (this.data.dueReview) {
        wx.setStorageSync('autoStartReview', 1);
        trackEvent('review_entry_click', 'task_card');
      }
      wx.switchTab({ url: '/pages/book/book' });
    } else {
      this.onCalendar();
    }
  },
  onReviewEntry() {
    if (!this.data.dueReview) return;
    trackEvent('review_entry_click', 'home_card');
    wx.setStorageSync('autoStartReview', 1);
    wx.switchTab({ url: '/pages/book/book' });
  },
  onGoBook() {
    wx.switchTab({ url: '/pages/book/book' });
  },
  onSetGoal(e: WechatMiniprogram.TouchEvent) {
    this.applyGoal(Number(e.currentTarget.dataset.goal));
  },
  applyGoal(g: number) {
    if (!g) return;
    setDailyGoal(g);
    this.refreshGoal();
    saveServerDailyGoal(g).catch(() => undefined);
  },
  // 目标改为 actionSheet 选择，不占首屏
  onPickGoal() {
    const chips = this.data.goalChips as number[];
    wx.showActionSheet({
      itemList: chips.map((g) => '每日 ' + g + ' 题'),
      success: (r) => this.applyGoal(chips[r.tapIndex]),
      fail: () => undefined,
    });
  },
  onQuick(e: WechatMiniprogram.CustomEvent<{ key: string }>) {
    const k = e.detail.key;
    if (k === 'real') this.onRealPractice();
    else if (k === 'exam') this.onGoExamList();
    else if (k === 'shenlun') this.onGoShenlun();
    else if (k === 'ask') this.onAsk();
  },
  onGoPlan() {
    this.setData({ planOpen: true });
  },
  onPlanVisible(e: WechatMiniprogram.CustomEvent<{ visible: boolean }>) {
    if (!e.detail.visible) this.setData({ planOpen: false });
  },
  onClosePlan() {
    this.setData({ planOpen: false });
  },
  onPlanEdit() {
    this.setData({ planOpen: false });
    this.onOpenSetup();
  },
  onStartModule(e: WechatMiniprogram.TouchEvent) {
    const mod = String(e.currentTarget.dataset.mod || '');
    wx.navigateTo({
      url: '/pages/practice/practice' + (mod ? '?module=' + mod : ''),
    });
  },
  // 今日主攻：POST /api/user_state 后服务端刷新推荐，重新拉 daily_plan（+ plan/today）
  async onFocus(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const mod = String(e.detail.value || '');
    const next = this.data.focus === mod ? '' : mod;
    try {
      await setUserFocus(next);
      this.applyPlan(await fetchDailyPlan());
      if (this._profile) this.applyPlanToday(await fetchPlanTodayFull());
      if (next) wx.showToast({ title: '今日主攻已设为' + moduleMeta(next).label + '，推荐已更新', icon: 'none' });
    } catch (err) {
      /* 非关键路径 */
    }
  },
  // 薄弱项推荐 → 练 10 题（source=reco 埋点，同 H5 startPreset(..., 'reco')）
  onWeak(e: WechatMiniprogram.TouchEvent) {
    const w = this.data.weakList[Number(e.currentTarget.dataset.index)];
    if (!w) return;
    let url = '/pages/practice/practice?count=10&source=reco&module=' + w.module;
    if (w.submodule) url += '&submodule=' + encodeURIComponent(w.submodule);
    if (w.tag3) url += '&tag3=' + encodeURIComponent(w.tag3);
    wx.navigateTo({ url });
  },
  onOpenSetup() {
    this.setData({ setupOpen: true, setupStep: 1 });
  },
  onCloseSetup() {
    this.setData({ setupOpen: false });
  },
  onSetupVisible(e: WechatMiniprogram.CustomEvent<{ visible: boolean }>) {
    if (!e.detail.visible) this.onCloseSetup();
  },
  onSkipGuide() {
    wx.setStorageSync('planGuideHide', 1);
    this.setData({ guideHide: true });
    wx.showToast({ title: '已跳过，可在「我的」随时制定', icon: 'none' });
  },
  onPfChip(e: WechatMiniprogram.CustomEvent<{ value: string | number }>) {
    const key = String(e.currentTarget.dataset.key || '');
    let val: string | number = e.detail.value;
    if (key === 'target_score' || key === 'daily_minutes') val = Number(val);
    this.setData({ ['pf.' + key]: val });
  },
  onPfRegion(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ 'pf.target_region': e.detail.value });
  },
  onPfDate(e: WechatMiniprogram.PickerChange) {
    this.setData({ 'pf.exam_date': String(e.detail.value) });
  },
  onSetupBack() {
    if (this.data.setupStep > 1) this.setData({ setupStep: this.data.setupStep - 1 });
  },
  async onSetupNext() {
    const { setupStep, pf, setupBusy } = this.data;
    if (setupStep === 1 && !pf.exam_date) {
      wx.showToast({ title: '请先选择考试日期', icon: 'none' });
      return;
    }
    if (setupStep < 3) {
      this.setData({ setupStep: setupStep + 1 });
      return;
    }
    if (setupBusy) return;
    this.setData({ setupBusy: true });
    try {
      await saveProfile(pf);
      this.setData({ setupOpen: false });
      wx.showToast({ title: '学习计划已生成', icon: 'none' });
      this.loadHome();
    } catch (e) {
      wx.showToast({ title: '保存失败，请稍后再试', icon: 'none' });
    } finally {
      this.setData({ setupBusy: false });
    }
  },
  onContinueGoal() {
    wx.navigateTo({ url: '/pages/practice/practice' });
  },
  // 计划任务路由（同 H5 goTask）：mock→真题卷/迷你模考；review→错题本；reinforce→强化 5 题；其余→练剩余量
  onPlanTask(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.index);
    const t = this.data.planTasks[idx];
    if (!t || t.done) return;
    this.setData({ planOpen: false });
    if (t.type === 'mock') {
      // 真题/冲刺阶段（plan real）计划文案为「整卷全真模考」→ 卷库；其余阶段进模考 tab
      if (t.real || this.data.realMode) this.onGoExamList();
      else wx.switchTab({ url: '/pages/exam/exam' });
      return;
    }
    if (t.type === 'review') {
      wx.switchTab({ url: '/pages/book/book' });
      return;
    }
    if (t.type === 'reinforce') {
      let url = '/pages/practice/practice?count=5';
      if (t.module) url += '&module=' + t.module;
      if (t.submodule) url += '&submodule=' + encodeURIComponent(t.submodule);
      if (t.tag3) url += '&tag3=' + encodeURIComponent(t.tag3);
      wx.navigateTo({ url });
      return;
    }
    const remain = Math.max(t.target - (t.done_n || 0), 5);
    let url = '/pages/practice/practice?count=' + remain;
    if (t.module) url += '&module=' + t.module;
    if (t.submodule) url += '&submodule=' + encodeURIComponent(t.submodule);
    if (t.real) url += '&real=1';
    wx.navigateTo({ url });
  },
});
