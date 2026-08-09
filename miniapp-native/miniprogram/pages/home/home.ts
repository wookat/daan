import { fetchPlanToday, fetchProfile, saveProfile } from '../../api/index';
import type { PlanTask, Profile } from '../../api/types';
import { getDailyGoal, setDailyGoal, streakDays, todayCount, todayKey } from '../../utils/stats';
import { syncTabBar } from '../../utils/tabbar';

interface ModCard {
  key: string;
  name: string;
  color: string;
  bg: string;
}

const MODS: ModCard[] = [
  { key: 'ziliao', name: '资料分析', color: '#0D9488', bg: '#D1FAE5' },
  { key: 'shuliang', name: '数量关系', color: '#1D4ED8', bg: '#DBEAFE' },
  { key: 'yanyu', name: '言语理解', color: '#B91C1C', bg: '#FEE2E2' },
  { key: 'panduan', name: '判断推理', color: '#6D28D9', bg: '#EDE9FE' },
  { key: 'changshi', name: '常识判断', color: '#B45309', bg: '#FEF3C7' },
  { key: '', name: '全模块混练', color: '#3B6FF5', bg: '#DCE7FD' },
];

const EXAM_TYPES = ['国考', '省考', '事业单位', '其他'];
const SCORES = [60, 65, 70, 75, 80];
const LEVELS = ['零基础', '有基础', '二战'];
const MINUTES = [30, 60, 90, 120];

function defaultProfile(): Profile {
  return {
    exam_type: '国考',
    target_region: '',
    exam_date: '',
    target_score: 70,
    daily_minutes: 60,
    base_level: '零基础',
  };
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
    profileLoaded: false,
    planTasks: [] as PlanTask[],
    planPct: 0,
    daysLeft: null as number | null,
    // 计划设置弹层
    setupVisible: false,
    setupStep: 0,
    pf: defaultProfile(),
    saving: false,
    examTypes: EXAM_TYPES,
    scores: SCORES,
    levels: LEVELS,
    minutes: MINUTES,
    todayStr: '',
    szDone: false,
    szRight: 0,
  },
  onShow() {
    syncTabBar(this, 0);
    this.refreshGoal();
    this.loadPlan();
    this.refreshShizheng();
  },
  refreshShizheng() {
    const sz = wx.getStorageSync<{ days?: Record<string, { right: number }> }>('szDaily');
    const done = sz && sz.days ? sz.days[todayKey()] : null;
    this.setData({ szDone: !!done, szRight: done ? done.right : 0 });
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
  },
  async loadPlan() {
    try {
      const d = await fetchProfile();
      if (!d.profile) {
        this.setData({ hasProfile: false, profileLoaded: true, planTasks: [] });
        return;
      }
      const plan = await fetchPlanToday();
      const tasks = plan.tasks || [];
      const done = tasks.filter((t) => t.done).length;
      this.setData({
        hasProfile: true,
        profileLoaded: true,
        planTasks: tasks,
        daysLeft: plan.days_left ?? null,
        planPct: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      });
    } catch {
      /* 非关键路径 */
    }
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
  onContinueGoal() {
    wx.navigateTo({ url: '/pages/practice/practice' });
  },
  onSearch() {
    wx.navigateTo({ url: '/pages/search/search' });
  },
  onShizheng() {
    wx.navigateTo({
      url: '/pages/practice/practice?mode=' + (this.data.szDone ? 'szreview' : 'shizheng'),
    });
  },
  onSzFavs() {
    wx.navigateTo({ url: '/pages/szfav/szfav' });
  },
  onFeature(e: WechatMiniprogram.TouchEvent) {
    const url = String(e.currentTarget.dataset.url || '');
    if (url) wx.navigateTo({ url });
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
    let url = '/pages/practice/practice?count=' + remain + '&source=reco';
    if (t.module) url += '&module=' + t.module;
    if (t.submodule) url += '&submodule=' + encodeURIComponent(t.submodule);
    wx.navigateTo({ url });
  },

  // ---------- 学习计划三步设置 ----------
  async onOpenSetup() {
    let pf = defaultProfile();
    try {
      const d = await fetchProfile();
      if (d.profile) pf = { ...pf, ...d.profile };
    } catch {
      /* 用默认值 */
    }
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    this.setData({ setupVisible: true, setupStep: 0, pf, todayStr });
  },
  onCloseSetup() {
    this.setData({ setupVisible: false });
  },
  noop() {
    /* 阻止冒泡 */
  },
  onPickExamType(e: WechatMiniprogram.TouchEvent) {
    this.setData({ 'pf.exam_type': String(e.currentTarget.dataset.v) });
  },
  onRegionInput(e: WechatMiniprogram.Input) {
    this.setData({ 'pf.target_region': e.detail.value });
  },
  onPickDate(e: WechatMiniprogram.PickerChange) {
    this.setData({ 'pf.exam_date': String(e.detail.value) });
  },
  onPickScore(e: WechatMiniprogram.TouchEvent) {
    this.setData({ 'pf.target_score': Number(e.currentTarget.dataset.v) });
  },
  onPickLevel(e: WechatMiniprogram.TouchEvent) {
    this.setData({ 'pf.base_level': String(e.currentTarget.dataset.v) });
  },
  onPickMinutes(e: WechatMiniprogram.TouchEvent) {
    this.setData({ 'pf.daily_minutes': Number(e.currentTarget.dataset.v) });
  },
  onSetupPrev() {
    if (this.data.setupStep > 0) this.setData({ setupStep: this.data.setupStep - 1 });
  },
  async onSetupNext() {
    const { setupStep, pf } = this.data;
    if (setupStep === 0 && !pf.exam_date) {
      wx.showToast({ title: '请选择考试日期', icon: 'none' });
      return;
    }
    if (setupStep < 2) {
      this.setData({ setupStep: setupStep + 1 });
      return;
    }
    if (this.data.saving) return;
    this.setData({ saving: true });
    try {
      await saveProfile(pf);
      this.setData({ setupVisible: false, saving: false });
      wx.showToast({ title: '计划已生成', icon: 'success' });
      this.loadPlan();
    } catch (e) {
      this.setData({ saving: false });
      wx.showToast({ title: (e as Error).message, icon: 'none' });
    }
  },
});
