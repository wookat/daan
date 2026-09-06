// Grow 组（首页聚合 / 计划 / 时政 / 统计 / 日历 / 周报 / 掌握度地图）新增接口封装。
// 独立文件而非追加到 api/index.ts：与其他并行组共享集成分支，避免同文件追加冲突。
// 所有接口均为后端已存在且 H5 在用的接口，路径与 uid 传参方式与 frontend-uni/src 一致。
import { request } from '../utils/request';
import { anonUid, pkNickname } from '../utils/auth';
import type { CheckinBadgesResp, CheckinSummaryResp, Profile, Question } from './types';

// ---------- 首页聚合 /api/home_bundle ----------

export interface WeakTopic {
  module: string | null;
  submodule: string;
  tag3?: string | null;
  label?: string | null;
  n: number;
  acc: number;
  reason: string;
  weakness?: number;
}

export interface DailyPlanResp {
  yesterday: { n: number; correct: number; secs: number; modules: string[] };
  due_mistakes: number;
  weak: WeakTopic[];
  focus: string;
}

export interface PlanTodayTask {
  key: string;
  type: 'review' | 'reinforce' | 'practice' | 'mock' | string;
  title: string;
  sub?: string;
  target: number;
  done_n?: number;
  done?: boolean;
  module?: string | null;
  submodule?: string | null;
  tag3?: string | null;
  real?: boolean;
}

export interface PlanTodayResp {
  profile: HomeProfile | null;
  tasks: PlanTodayTask[];
  days_left?: number | null;
  phase?: string;
  phase_name?: string;
  real_mode?: boolean;
  progress?: { done: number; total: number };
  today?: { n: number; correct: number };
}

/** /api/profile 里的 daily_goal 是服务端每日目标（H5 daily-goal.js adoptServerDailyGoal 口径） */
export type HomeProfile = Profile & { daily_goal?: number | null };

export const DAILY_GOALS = [20, 50, 100];

export function normalizeDailyGoal(v: unknown): number | null {
  return typeof v === 'number' && DAILY_GOALS.indexOf(v) >= 0 ? v : null;
}

/** 服务端目标与本地不同时返回服务端值，否则 null（照搬 H5 adoptServerDailyGoal） */
export function adoptServerDailyGoal(localGoal: number, profile: HomeProfile | null): number | null {
  if (!profile) return null;
  const server = normalizeDailyGoal(profile.daily_goal);
  if (server == null) return null;
  return server === normalizeDailyGoal(localGoal) ? null : server;
}

export function saveServerDailyGoal(goal: number): Promise<unknown> {
  return request('/api/profile', { method: 'POST', data: { uid: anonUid(), daily_goal: goal } });
}

export interface HomeBundleResp {
  plan: DailyPlanResp;
  profile: HomeProfile | null;
  plan_today: PlanTodayResp | null;
  badges: CheckinBadgesResp;
  summary: CheckinSummaryResp;
}

export function fetchHomeBundle(): Promise<HomeBundleResp> {
  return request<HomeBundleResp>('/api/home_bundle?uid=' + encodeURIComponent(anonUid()));
}

export function fetchDailyPlan(): Promise<DailyPlanResp> {
  return request<DailyPlanResp>('/api/daily_plan?uid=' + encodeURIComponent(anonUid()));
}

export function fetchPlanTodayFull(): Promise<PlanTodayResp> {
  return request<PlanTodayResp>('/api/plan/today?uid=' + encodeURIComponent(anonUid()));
}

/** 今日主攻模块（空串=取消）；服务端会同步刷新 daily_plan 推荐 */
export function setUserFocus(focus: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/user_state', {
    method: 'POST',
    data: { uid: anonUid(), focus },
  });
}

// ---------- 公告 ----------

export interface Announcement {
  id: number;
  title: string;
  body?: string | null;
}

export function fetchAnnouncement(): Promise<{ item: Announcement | null }> {
  return request<{ item: Announcement | null }>('/api/announcement');
}

// ---------- 续练 / 续考 / 续复习 ----------

export interface PracticeResumeResp {
  items?: Question[];
  picks?: Record<string, string>;
  idx?: number;
  right?: number;
  module?: string | null;
  submodule?: string | null;
  source?: string | null;
  ptitle?: string | null;
  t?: number;
}

export function fetchPracticeResume(): Promise<PracticeResumeResp> {
  return request<PracticeResumeResp>('/api/practice/resume?uid=' + encodeURIComponent(anonUid()));
}

export interface ExamResumeResp {
  attempt_id?: number;
  paper?: { id: number; title: string; kind?: string | null; duration_min?: number; n?: number };
  items?: Question[];
  picks?: Record<string, string>;
  idx?: number;
  end_at_ms?: number;
}

export function fetchExamResume(): Promise<ExamResumeResp> {
  return request<ExamResumeResp>('/api/exam/resume?uid=' + encodeURIComponent(anonUid()));
}

export interface ReviewSnap {
  v?: number;
  uid?: string;
  rIdx: number;
  items: unknown[];
  ts?: number;
}

export function fetchReviewCur(): Promise<{ snap?: ReviewSnap | string | null }> {
  return request<{ snap?: ReviewSnap | string | null }>('/api/review/cur?uid=' + encodeURIComponent(anonUid()));
}

export function clearReviewCur(): Promise<unknown> {
  return request('/api/review/cur', { method: 'POST', data: { uid: anonUid(), snap: null } });
}

export function dropPracticeProgress(): Promise<unknown> {
  return request('/api/practice/progress', { method: 'POST', data: { uid: anonUid(), qids: [] } });
}

export function dropExamProgress(attemptId: number): Promise<unknown> {
  return request('/api/exam/progress', {
    method: 'POST',
    data: { uid: anonUid(), attempt_id: attemptId, drop: true },
  });
}

// ---------- 每日一练（全站同题） / 时政 ----------

export interface DailySetResp {
  date: string;
  items: Question[];
  stats: { participants: number; avg_right: number | null };
}

export function fetchDailySet(date?: string): Promise<DailySetResp> {
  return request<DailySetResp>('/api/daily_set' + (date ? '?date=' + encodeURIComponent(date) : ''));
}

/** 后端 db.daily_set_board 行：name 已脱敏（昵称或 uid 前 6 位***） */
export interface DailyBoardRow {
  rank: number;
  name: string;
  right: number;
  total: number;
  secs: number | null;
}

export function fetchDailyBoard(): Promise<{ date: string; items: DailyBoardRow[] }> {
  return request<{ date: string; items: DailyBoardRow[] }>('/api/daily_set/board');
}

export interface DailySubmitPayload {
  uid: string;
  nickname: string;
  date: string;
  right: number;
  total: number;
  secs: number | null;
}

export interface DailySubmitResp {
  my_right: number;
  my_rank: number | null;
  participants: number;
  already?: boolean;
  streak: number;
  beat_pct: number | null;
}

export interface DailyDoneRec {
  date: string;
  right: number;
  total: number;
  rank: number | null;
  streak: number;
}

const DAILY_PENDING_KEY = 'dailyPending';

export function dailyDoneKey(): string {
  return 'dailyDone:' + anonUid();
}

/** 与 H5 submitDailySet 同：先落待提交，成功后按 uid 隔离写 dailyDone:<uid> */
export function submitDailySet(p: Omit<DailySubmitPayload, 'uid' | 'nickname'>): Promise<DailySubmitResp> {
  const payload: DailySubmitPayload = { uid: anonUid(), nickname: pkNickname(), ...p };
  wx.setStorageSync(DAILY_PENDING_KEY, payload);
  return request<DailySubmitResp>('/api/daily_set/submit', { method: 'POST', data: payload }).then((d) => {
    wx.removeStorageSync(DAILY_PENDING_KEY);
    const rec: DailyDoneRec = {
      date: payload.date,
      right: d.my_right,
      total: payload.total,
      rank: d.my_rank,
      streak: d.streak,
    };
    wx.setStorageSync('dailyDone:' + payload.uid, rec);
    return d;
  });
}

/** 断网时未提交成功的当日成绩，下次进首页/每日一练补交（仅当日有效，服务端拒绝非当日） */
export function flushDailySubmit(cnDay: string): void {
  const p = wx.getStorageSync<DailySubmitPayload | ''>(DAILY_PENDING_KEY);
  if (!p || !p.uid) return;
  if (p.date !== cnDay) {
    wx.removeStorageSync(DAILY_PENDING_KEY);
    return;
  }
  request<DailySubmitResp>('/api/daily_set/submit', { method: 'POST', data: p })
    .then((d) => {
      wx.removeStorageSync(DAILY_PENDING_KEY);
      wx.setStorageSync('dailyDone:' + p.uid, {
        date: p.date,
        right: d.my_right,
        total: p.total,
        rank: d.my_rank,
        streak: d.streak,
      } as DailyDoneRec);
    })
    .catch(() => undefined);
}

export function loadDailyDone(): DailyDoneRec | null {
  const d = wx.getStorageSync<DailyDoneRec | ''>(dailyDoneKey());
  return d && d.date ? d : null;
}

/** 时政每日一练完成态：按 uid 隔离（照搬 H5 checkin.js loadSzDaily/saveSzDaily，含旧全局 key 迁移） */
export interface SzDayRec {
  right: number;
  best: number;
  picks: string[];
  secs: number[];
}

export interface SzDaily {
  days: Record<string, SzDayRec>;
}

export function loadSzDaily(): SzDaily {
  const key = 'szDaily:' + anonUid();
  let d = wx.getStorageSync<SzDaily | ''>(key);
  if (!d) {
    d = wx.getStorageSync<SzDaily | ''>('szDaily');
    if (d) {
      wx.removeStorageSync('szDaily');
      wx.setStorageSync(key, d);
    }
  }
  return d || { days: {} };
}

export function saveSzDaily(d: SzDaily): void {
  wx.setStorageSync('szDaily:' + anonUid(), d);
}

export interface ShizhengQuestion extends Question {
  date?: string;
  source_note?: string | null;
}

export function fetchShizhengDaily(date?: string): Promise<{ date: string; items: ShizhengQuestion[] }> {
  return request<{ date: string; items: ShizhengQuestion[] }>(
    '/api/shizheng/daily' + (date ? '?date=' + encodeURIComponent(date) : '')
  );
}

// ---------- 统计页 ----------

/** 注意：by_module.module 已由服务端换成中文名（kb.MODULES.name），不是 key */
export interface StatsResp {
  by_module: { module: string; n: number }[];
  by_type: { question_type: string | null; n: number }[];
  by_reason: { error_reason: string; n: number }[];
}

export function fetchStats(): Promise<StatsResp> {
  return request<StatsResp>('/api/stats?uid=' + encodeURIComponent(anonUid()));
}

export interface PredictModule {
  module: string;
  name: string;
  score: number;
  max: number;
  n: number;
  acc: number;
  trend: number;
  coverage?: number;
}

export interface PredictHistory {
  week_end: string;
  label: string;
  score: number;
}

export interface PredictResp {
  status: 'cold' | 'ok' | string;
  n: number;
  need?: number;
  score?: number;
  n_recent?: number;
  n_exam?: number;
  confidence?: string;
  delta_week?: number | null;
  modules?: PredictModule[];
  history?: PredictHistory[];
}

export function fetchPredict(): Promise<PredictResp> {
  return request<PredictResp>('/api/predict?uid=' + encodeURIComponent(anonUid()));
}

export function fetchRecommend(): Promise<{ items: WeakTopic[] }> {
  return request<{ items: WeakTopic[] }>('/api/recommend?uid=' + encodeURIComponent(anonUid()));
}

export interface ExamAttempt {
  id: number;
  paper_id: number;
  title?: string;
  kind?: string | null;
  score: number | null;
  submitted_at: number | null;
  started_at: number;
  per_module?: Record<string, { answered: number; correct: number }>;
}

export function fetchExamAttempts(limit = 20): Promise<{ items: ExamAttempt[] }> {
  return request<{ items: ExamAttempt[] }>(
    '/api/exam/attempts?uid=' + encodeURIComponent(anonUid()) + '&limit=' + limit
  );
}

export interface ShenlunStatsResp {
  total: number;
  last_at: number | null;
  by_type: { qtype: string; n: number }[];
  issues: { qtype: string; kind: string; text: string }[];
}

export function fetchShenlunStats(): Promise<ShenlunStatsResp> {
  return request<ShenlunStatsResp>('/api/shenlun/stats?uid=' + encodeURIComponent(anonUid()));
}

// ---------- 掌握度地图 ----------

export interface MasteryTag3 {
  code: string;
  name: string;
  n: number;
  acc: number;
  mastery: number;
  level: string;
  level_name: string;
  due_mistakes: number;
  qn: number;
}

export interface MasterySub {
  code: string;
  submodule: string;
  n: number;
  acc: number;
  mastery: number;
  level: string;
  level_name: string;
  tag3s: MasteryTag3[];
}

export interface MasteryModule {
  module: string;
  name: string;
  n: number;
  mastery: number;
  level?: string;
  subs: MasterySub[];
}

export interface MasteryMapResp {
  n_total: number;
  cold: boolean;
  need: number;
  coverage: { practiced: number; total: number; pct: number };
  modules: MasteryModule[];
}

export function fetchMasteryMap(): Promise<MasteryMapResp> {
  return request<MasteryMapResp>('/api/mastery/map?uid=' + encodeURIComponent(anonUid()));
}

// ---------- 周学习报告 ----------

export interface WeeklySummary {
  n: number;
  c?: number;
  acc: number;
  secs: number;
  days: number;
  reviews?: number;
  n_exams?: number;
}

export interface WeeklyMasteryChange {
  submodule: string;
  module?: string | null;
  acc: number;
  prev_acc: number;
  delta: number;
}

export interface WeeklyAction {
  type: 'review' | 'practice' | 'mock' | string;
  title: string;
  url?: string;
}

export interface WeeklyReportResp {
  status: 'ok' | 'pending' | 'empty' | string;
  week_start: number;
  week_end?: number;
  range: string;
  prev_week?: string;
  summary?: WeeklySummary;
  prev?: WeeklySummary;
  badges?: { key: string; title: string; desc: string }[];
  compare?: { n: number[]; acc: number[]; secs: number[]; days: number[] };
  mastery?: { up: WeeklyMasteryChange[]; down: WeeklyMasteryChange[] };
  reasons?: { reason: string; n: number; prev_n: number }[];
  mock?: { attempt_id: number; score: number; n_exams: number; event_title?: string; rank?: number | null; pct?: number } | null;
  actions?: WeeklyAction[];
}

export function fetchWeeklyReport(week?: string): Promise<WeeklyReportResp> {
  return request<WeeklyReportResp>(
    '/api/report/weekly?uid=' + encodeURIComponent(anonUid()) + (week ? '&week=' + encodeURIComponent(week) : '')
  );
}

export function markWeeklyReportRead(week: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/report/weekly/read', {
    method: 'POST',
    data: { uid: anonUid(), week },
  });
}

export interface NextEvent {
  id: number;
  title: string;
  open_at: number;
  close_at?: number;
}

export function fetchNextWeeklyEvent(): Promise<{ event: NextEvent | null }> {
  return request<{ event: NextEvent | null }>('/api/report/weekly/next_event');
}
