// Learn 组（刷题核心链路）接口封装：与 frontend-uni/src 同接口、同参数口径。
// 新增文件，不改 api/index.ts；uid 一律走 utils/auth.anonUid()。
import { anonUid } from '../utils/auth';
import { request } from '../utils/request';
import type { Question } from './types';

// ---------- 选题（首页设置 / 题型选择） ----------

export interface RealFilters {
  years: { y: number; n: number }[];
  regions: { r: string; n: number }[];
}
export function fetchRealFilters(): Promise<RealFilters> {
  return request<RealFilters>('/api/real_filters');
}

export interface SubmoduleCount {
  submodule: string;
  n: number;
}
export function fetchSubmodules(module: string): Promise<{ items: SubmoduleCount[] }> {
  return request<{ items: SubmoduleCount[] }>('/api/submodules?module=' + encodeURIComponent(module));
}

export type SubmoduleProgress = Record<string, { n: number; c: number }>;
export function fetchSubmoduleProgress(module: string): Promise<{ items: SubmoduleProgress }> {
  return request<{ items: SubmoduleProgress }>(
    '/api/submodule_progress?uid=' + encodeURIComponent(anonUid()) + '&module=' + encodeURIComponent(module)
  );
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
}
export function fetchAnnouncement(): Promise<{ item: Announcement | null }> {
  return request<{ item: Announcement | null }>('/api/announcement');
}

// 与 practice.vue start() 的 /api/questions 拼参一致（real/year/region/adaptive/tag3/grouped）
export interface LearnDrawParams {
  limit: number;
  module?: string | null;
  submodule?: string | null;
  tag3?: string | null;
  adaptive?: boolean;
  real?: boolean;
  year?: number | string | null;
  region?: string | null;
  grouped?: boolean;
  mode?: 'reinforce' | '';
}
export function drawQuestions(p: LearnDrawParams): Promise<{ items: Question[] }> {
  let q = '/api/questions?limit=' + p.limit + '&uid=' + encodeURIComponent(anonUid());
  if (p.mode) q += '&mode=' + p.mode;
  if (p.real) {
    q += '&real=1';
    if (p.year) q += '&year=' + p.year;
    if (p.region) q += '&region=' + encodeURIComponent(p.region);
  }
  if (p.adaptive) q += '&adaptive=1';
  if (p.grouped) q += '&grouped=1';
  if (p.tag3) q += '&tag3=' + encodeURIComponent(p.tag3);
  if (p.module) q += '&module=' + p.module;
  if (p.submodule) q += '&submodule=' + encodeURIComponent(p.submodule);
  return request<{ items: Question[] }>(q, { timeout: 20000 });
}

export function saveGroupSize(n: number): Promise<void> {
  return request<void>('/api/profile', { method: 'POST', data: { uid: anonUid(), group_size: n } });
}
export function savePracticePref(key: 'auto_next' | 'timed_mode', on: boolean): Promise<void> {
  return request<void>('/api/profile', { method: 'POST', data: { uid: anonUid(), [key]: on ? 1 : 0 } });
}

// ---------- 续做 / 进度 ----------

export interface PracticeProgressPayload {
  qids: number[];
  picks: Record<string, string>;
  excl: Record<string, string[]>;
  idx: number;
  right: number;
  streak: number;
  best_streak: number;
  module: string;
  submodule: string;
  source: string;
  ptitle: string;
}
export function postPracticeProgress(payload: PracticeProgressPayload | { qids: [] }): Promise<void> {
  return request<void>('/api/practice/progress', { method: 'POST', data: { uid: anonUid(), ...payload } });
}

export interface PracticeResumeResp {
  items?: Question[];
  picks?: Record<string, string>;
  excl?: Record<string, string[]>;
  idx?: number;
  right?: number;
  streak?: number;
  best_streak?: number;
  module?: string;
  submodule?: string;
  source?: string;
  ptitle?: string;
}
export function fetchPracticeResume(): Promise<PracticeResumeResp> {
  return request<PracticeResumeResp>('/api/practice/resume?uid=' + encodeURIComponent(anonUid()));
}

// ---------- 题内社交 / 反馈 ----------

export interface FavStatus {
  faved: boolean;
  folder_id: number | null;
  note: string | null;
}
export function fetchFavStatus(questionId: number): Promise<FavStatus> {
  return request<FavStatus>(
    '/api/favs/status?uid=' + encodeURIComponent(anonUid()) + '&question_id=' + questionId
  );
}
export function setFav(questionId: number, folderId?: number | null): Promise<void> {
  return request<void>('/api/favs', {
    method: 'POST',
    data: { uid: anonUid(), question_id: questionId, folder_id: folderId || null },
  });
}

export function fetchCommentCount(questionId: number): Promise<{ total: number }> {
  return request<{ total: number }>('/api/comments/count?question_id=' + questionId);
}

export function rateExplanation(questionId: number, up: boolean): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/rate', { method: 'POST', data: { question_id: questionId, up } });
}

export function patchMistakeReason(mid: number, reason: string): Promise<void> {
  return request<void>('/api/mistakes/' + mid, { method: 'PATCH', data: { uid: anonUid(), error_reason: reason } });
}

// ---------- 搜索 ----------

export interface SearchBrief {
  id: number;
  code: string;
  module: string;
  submodule?: string | null;
  question: string;
  is_real?: number | boolean;
  exam_year?: number | null;
}
export interface SearchTopic {
  code: string;
  name: string;
  module: string;
  module_name: string;
  group_name: string;
  n?: number;
}
export interface SearchPaper {
  id: number;
  title: string;
  kind?: string;
  year?: number | null;
  region?: string | null;
}
export interface SearchShenlun {
  id: number;
  question: string;
  exam_year?: number | null;
  exam_region?: string | null;
  qtype?: string | null;
}
export interface SearchShenlunMat {
  id: number;
  topic: string;
  type?: string | null;
  content: string;
}
export interface SearchResp {
  q: string;
  code_hit?: SearchBrief;
  topics?: SearchTopic[];
  papers?: SearchPaper[];
  questions?: { total: number; items: SearchBrief[] };
  shenlun?: SearchShenlun[];
  shenlun_mats?: SearchShenlunMat[];
}
export function search(q: string, type: string, offset = 0): Promise<SearchResp> {
  return request<SearchResp>(
    '/api/search?q=' + encodeURIComponent(q) + '&type=' + type + (offset ? '&offset=' + offset : '')
  );
}
export interface SearchDetail extends SearchBrief {
  options: Record<string, string>;
  answer: string;
  explanation?: string | null;
  tag3?: string | null;
}
export function searchQuestion(qid: number): Promise<SearchDetail> {
  return request<SearchDetail>('/api/search/question/' + qid);
}

// ---------- 练习历史 ----------

export interface HistorySession {
  start: number;
  end: number;
  n: number;
  correct: number;
  secs: number;
  modules: string[];
  source?: string | null;
}
export function fetchPracticeHistory(): Promise<{ items: HistorySession[] }> {
  return request<{ items: HistorySession[] }>('/api/practice/history?uid=' + encodeURIComponent(anonUid()));
}
export interface HistoryDetailItem {
  created_at: number;
  module: string | null;
  submodule: string | null;
  correct: boolean;
  secs: number;
  picked: string | null;
  question: Question | null;
}
export function fetchPracticeHistoryDetail(start: number, end: number): Promise<{ items: HistoryDetailItem[] }> {
  return request<{ items: HistoryDetailItem[] }>(
    '/api/practice/history/detail?uid=' + encodeURIComponent(anonUid()) + '&start=' + start + '&end=' + end
  );
}

// ---------- 错题本扩展 ----------

export interface MistakeAnalysisResp {
  analysis: string;
  stats: Record<string, unknown>;
}
export function mistakeAnalysis(): Promise<MistakeAnalysisResp> {
  return request<MistakeAnalysisResp>('/api/mistakes/analysis', { method: 'POST', data: { uid: anonUid() }, timeout: 420000 });
}

export interface RedoFilter {
  limit?: number;
  qtype?: string | null;
  module?: string | null;
  noqt?: boolean;
  rz?: string | null;
  src?: string | null;
  t3?: string | null;
}
export function redoMistakesFiltered(f: RedoFilter): Promise<{ items: Question[]; skipped?: number }> {
  let q = '/api/mistakes/redo?limit=' + (f.limit || 10) + '&uid=' + encodeURIComponent(anonUid());
  if (f.qtype) q += '&qtype=' + encodeURIComponent(f.qtype);
  if (f.module) q += '&module=' + encodeURIComponent(f.module);
  if (f.noqt) q += '&noqt=1';
  if (f.rz) q += '&rz=' + encodeURIComponent(f.rz);
  if (f.src) q += '&src=' + f.src;
  if (f.t3) q += '&t3=' + encodeURIComponent(f.t3);
  return request<{ items: Question[]; skipped?: number }>(q);
}

export interface PaperInfo {
  code: string;
  title: string | null;
  n: number;
  created_at: number | null;
}
export function fetchPaperInfo(code: string): Promise<PaperInfo> {
  return request<PaperInfo>('/api/paper/' + encodeURIComponent(code.trim().toUpperCase()));
}
export interface PaperAnswerRow {
  no: number;
  question_id: number | null;
  module: string | null;
  picked: string | null;
  answer: string | null;
  correct: boolean;
  status: string;
  secs: number;
  question: string;
}
export interface PaperAnswersResp {
  code: string;
  title: string | null;
  total: number;
  answered: number;
  correct: number;
  saved: boolean;
  items: PaperAnswerRow[];
}
export function submitPaperAnswers(code: string, picks: Record<string, string>): Promise<PaperAnswersResp> {
  return request<PaperAnswersResp>('/api/paper_answers', {
    method: 'POST',
    data: { uid: anonUid(), code: code.trim().toUpperCase(), picks },
  });
}

export interface ReviewSnap {
  v: 1;
  uid: string;
  ts: number;
  rIdx: number;
  items: Array<Record<string, unknown> & { question_text: string }>;
  picked: string | null;
  answered: boolean;
  wasCorrect: boolean;
  nextDays: number;
}
export function fetchReviewCur(): Promise<{ snap?: ReviewSnap }> {
  return request<{ snap?: ReviewSnap }>('/api/review/cur?uid=' + encodeURIComponent(anonUid()));
}
export function saveReviewCur(snap: ReviewSnap | null): Promise<void> {
  return request<void>('/api/review/cur', { method: 'POST', data: { uid: anonUid(), snap } });
}

export interface ReinforceItem {
  kind: 'tag3' | 'sub';
  skill: string;
  tag3?: string;
  tag3_name?: string;
  module: string;
  module_name?: string;
  submodule: string;
  mastery: number;
  level_name: string;
  due: number;
  wrong_today: number;
  avail_n: number;
}
export function fetchReinforceSuggest(): Promise<{ items: ReinforceItem[]; picked: ReinforceItem | null }> {
  return request<{ items: ReinforceItem[]; picked: ReinforceItem | null }>(
    '/api/reinforce/suggest?uid=' + encodeURIComponent(anonUid())
  );
}

export interface AttemptItem {
  picked: string;
  correct: boolean;
  secs: number;
  created_at: number;
}
export function fetchAttempts(questionId: number): Promise<{ items: AttemptItem[] }> {
  return request<{ items: AttemptItem[] }>(
    '/api/attempts?uid=' + encodeURIComponent(anonUid()) + '&question_id=' + questionId
  );
}
