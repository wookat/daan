import {
  fetchCheckinBadges,
  fetchPlanToday,
  fetchProfile,
  fetchQuestionCounts,
  fetchReviewDue,
  saveProfile,
  trackEvent,
} from '../../api/index';
import type { CheckinBadgesResp, PlanTask, Profile } from '../../api/types';
import { getDailyGoal, setDailyGoal, streakDays, todayCount } from '../../utils/stats';
import { syncTabBar } from '../../utils/tabbar';

interface ModCard {
  key: string;
  name: string;
  color: string;
  bg: string;
  count: string;
}

// count 为静态回退（口径同生产 2026-08 /api/question_counts），接口成功后由 fmtCount 实时覆盖
const MODS: ModCard[] = [
  { key: 'ziliao', name: '资料分析', color: '#14B8A6', bg: '#E6F9F6', count: '4,600+ 题' },
  { key: 'shuliang', name: '数量关系', color: '#2e5bff', bg: '#eef3ff', count: '3.3 万题' },
  { key: 'yanyu', name: '言语理解', color: '#F43F5E', bg: '#FEF0F2', count: '1.8 万题' },
  { key: 'panduan', name: '判断推理', color: '#8B5CF6', bg: '#F3EFFE', count: '2.3 万题' },
  { key: 'changshi', name: '常识判断', color: '#F59E0B', bg: '#FEF7E6', count: '3.1 万题' },
  { key: '', name: '全模块混练', color: '#2e5bff', bg: '#dbe6ff', count: '10 万+ 题' },
];

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
    examTypes: ['国考', '省考', '事业单位', '其他'],
    scoreChips: [60, 65, 70, 75, 80],
    baseLevels: ['零基础', '有基础', '二战'],
    minuteChips: [30, 60, 90, 120],
    dateStart: '',
    dateEnd: '',
    planTasks: [] as PlanTask[],
    planPct: 0,
    daysLeft: null as number | null,
    dueReview: 0,
    dueLoaded: false,
    badgeStreak: 0,
    nextMilestone: null as { days: number; left: number; pct: number } | null,
    taskDoneN: 0,
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
  },
  refreshGoal() {
    const today = todayCount();
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
  onSheetNoop() {
    /* 阻止冒泡关闭 */
  },
  onSkipGuide() {
    wx.setStorageSync('planGuideHide', 1);
    this.setData({ guideHide: true });
    wx.showToast({ title: '已跳过，可在「我的」随时制定', icon: 'none' });
  },
  onPfChip(e: WechatMiniprogram.TouchEvent) {
    const key = String(e.currentTarget.dataset.key || '');
    let val: string | number = String(e.currentTarget.dataset.val || '');
    if (key === 'target_score' || key === 'daily_minutes') val = Number(val);
    this.setData({ ['pf.' + key]: val });
  },
  onPfRegion(e: WechatMiniprogram.Input) {
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
      wx.switchTab({ url: '/pages/exam/exam' });
      return;
    }
    const remain = Math.max(t.target - (t.done_n || 0), 5);
    let url = '/pages/practice/practice?count=' + remain;
    if (t.module) url += '&module=' + t.module;
    if (t.submodule) url += '&submodule=' + encodeURIComponent(t.submodule);
    wx.navigateTo({ url });
  },
});
