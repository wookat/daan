import {
  fetchCheckinBadges,
  fetchCheckinSummary,
  fetchPlanToday,
  fetchProfile,
  fetchQuestionCounts,
  fetchReviewDue,
  saveProfile,
  trackEvent,
} from '../../api/index';
import { fetchPracticeResume, fetchReviewCur, postPracticeProgress, saveReviewCur } from '../../api/learn';
import type { CheckinBadgesResp, PlanTask, Profile } from '../../api/types';
import { anonUid } from '../../utils/auth';
import { examResume, examProgressDrop } from '../../api/exam';
import { type ResumeInfo, resolveResume, dropResume, resumeUrl } from '../../utils/kg-exam-progress';
import { fmtClock } from '../../utils/kg-exam-timer';
import { moduleMeta } from '../../utils/module-meta';
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

Page({
  data: {
    today: 0,
    goal: 20,
    goalPct: 0,
    streak: 0,
    mods: MODS,
    goalChips: [20, 50, 100],
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
    planTasks: [] as PlanTask[],
    planPct: 0,
    daysLeft: null as number | null,
    dueReview: 0,
    dueLoaded: false,
    clearedToday: 0,
    badgeStreak: 0,
    nextMilestone: null as { days: number; left: number; pct: number } | null,
    taskDoneN: 0,
    // H5 resumes：未做完的练习 / 未完成的错题复习
    practiceResume: null as (ResumeBrief & { name: string }) | null,
    reviewResume: null as ReviewResume | null,
    examResume: null as (ResumeInfo & { leftText: string }) | null,
  },
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
    this.loadPlan();
    this.loadDueReview();
    this.loadBadges();
    this.loadTodayServer();
    this.loadPracticeResume();
    this.loadReviewResume();
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
    this.loadExamResume();
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
  // 今日已练以服务端为准（answer_log+review_log，与统计页同源），本机 pstats 只做首屏占位与离线降级
  async loadTodayServer() {
    try {
      const d = await fetchCheckinSummary();
      if (d.today_n == null) return;
      const today = d.today_n;
      this._serverToday = today;
      this.setData({
        today,
        clearedToday: d.cleared_today || 0,
        goalPct: Math.min(100, Math.round((today / this.data.goal) * 100)),
      });
      this.updateTaskCard();
    } catch (e) {
      /* 非关键路径 */
    }
  },
  _serverToday: null as number | null,
  refreshGoal() {
    const today = this._serverToday ?? todayCount();
    const goal = getDailyGoal();
    this.setData({
      today,
      goal,
      goalPct: Math.min(100, Math.round((today / goal) * 100)),
      streak: streakDays(),
    });
    this.updateTaskCard();
  },
  async loadPlan() {
    try {
      const d = await fetchProfile();
      if (!d.profile) {
        this.setData({ hasProfile: false, planTasks: [], planLoaded: true });
        return;
      }
      const plan = await fetchPlanToday();
      const tasks = plan.tasks || [];
      const done = tasks.filter((t) => t.done).length;
      this.setData({
        hasProfile: true,
        planLoaded: true,
        planTasks: tasks,
        daysLeft: plan.days_left ?? null,
        planPct: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      });
    } catch (e) {
      /* 非关键路径 */
    }
  },
  async loadDueReview() {
    try {
      const r = await fetchReviewDue();
      this.setData({ dueReview: r.total || (r.items || []).length, dueLoaded: true });
      this.updateTaskCard();
    } catch (e) {
      /* 非关键路径 */
    }
  },
  // 连签口径以服务端 /api/checkin/badges 为准（hero / 任务卡同源），失败降级本机 streak
  async loadBadges() {
    try {
      const b: CheckinBadgesResp = await fetchCheckinBadges();
      this.setData({ badgeStreak: b.streak, streak: b.streak });
      this.updateMilestone(
        b.streak,
        (b.badges || []).map((x) => x.days)
      );
    } catch (e) {
      this.updateMilestone(this.data.streak, [3, 7, 14, 30, 60, 100]);
    }
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
      wx.switchTab({ url: '/pages/profile/profile' });
    }
  },
  onReviewEntry() {
    if (!this.data.dueReview) return;
    trackEvent('review_entry_click', 'home_card');
    wx.setStorageSync('autoStartReview', 1);
    wx.switchTab({ url: '/pages/book/book' });
  },
  onSetGoal(e: WechatMiniprogram.TouchEvent) {
    const g = Number(e.currentTarget.dataset.goal);
    setDailyGoal(g);
    this.refreshGoal();
  },
  onAsk() {
    wx.navigateTo({ url: '/pkgSocial/ask/ask' });
  },
  onGoBook() {
    wx.switchTab({ url: '/pages/book/book' });
  },
  onStartModule(e: WechatMiniprogram.TouchEvent) {
    const mod = String(e.currentTarget.dataset.mod || '');
    wx.navigateTo({
      url: '/pages/practice/practice' + (mod ? '?module=' + mod : ''),
    });
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
      this.loadPlan();
    } catch (e) {
      wx.showToast({ title: '保存失败，请稍后再试', icon: 'none' });
    } finally {
      this.setData({ setupBusy: false });
    }
  },
  onContinueGoal() {
    wx.navigateTo({ url: '/pages/practice/practice' });
  },
  onPlanTask(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.index);
    const t = this.data.planTasks[idx];
    if (!t || t.done) return;
    if (t.type === 'review') {
      wx.switchTab({ url: '/pages/book/book' });
      return;
    }
    if (t.type === 'mock') {
      // 真题/冲刺阶段（plan real）计划文案为「整卷全真模考」→ 卷库；其余阶段进模考 tab
      if (t.real) this.onGoExamList();
      else wx.switchTab({ url: '/pages/exam/exam' });
      return;
    }
    const remain = Math.max(t.target - (t.done_n || 0), 5);
    let url = '/pages/practice/practice?count=' + remain;
    if (t.module) url += '&module=' + t.module;
    if (t.submodule) url += '&submodule=' + encodeURIComponent(t.submodule);
    wx.navigateTo({ url });
  },
});
