import {
  fetchCheckinBadges,
  fetchPlanToday,
  fetchProfile,
  fetchReviewDue,
  trackEvent,
} from '../../api/index';
import type { CheckinBadgesResp, PlanTask } from '../../api/types';
import { getDailyGoal, setDailyGoal, streakDays, todayCount } from '../../utils/stats';
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

Page({
  data: {
    today: 0,
    goal: 20,
    goalPct: 0,
    streak: 0,
    mods: MODS,
    goalChips: [20, 50, 100],
    hasProfile: false,
    planTasks: [] as PlanTask[],
    planPct: 0,
    daysLeft: null as number | null,
    dueReview: 0,
    dueLoaded: false,
    badgeStreak: 0,
    nextMilestone: null as { days: number; left: number; pct: number } | null,
    taskDoneN: 0,
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
        this.setData({ hasProfile: false, planTasks: [] });
        return;
      }
      const plan = await fetchPlanToday();
      const tasks = plan.tasks || [];
      const done = tasks.filter((t) => t.done).length;
      this.setData({
        hasProfile: true,
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
  // 连签口径以服务端 /api/checkin/badges 为准，失败降级本机 streak
  async loadBadges() {
    try {
      const b: CheckinBadgesResp = await fetchCheckinBadges();
      this.setData({ badgeStreak: b.streak });
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
