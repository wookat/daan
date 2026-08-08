import { request } from '../utils/request';
import { anonUid } from '../utils/auth';
import type {
  AnswerLogItem,
  AuthResp,
  FavItem,
  Mistake,
  MistakesResp,
  Paper,
  PlanToday,
  PracticeResultResp,
  Profile,
  QuestionsResp,
} from './types';

// ---------- 题目 ----------

export interface DrawParams {
  limit?: number;
  module?: string | null;
  submodule?: string | null;
  tag3?: string | null;
  adaptive?: boolean;
  real?: boolean;
  mode?: string;
}

export function fetchQuestions(p: DrawParams): Promise<QuestionsResp> {
  const uid = anonUid();
  let q = '/api/questions?limit=' + (p.limit || 10) + '&uid=' + encodeURIComponent(uid);
  if (p.mode) q += '&mode=' + p.mode;
  if (p.module) q += '&module=' + p.module;
  if (p.submodule) q += '&submodule=' + encodeURIComponent(p.submodule);
  if (p.tag3) q += '&tag3=' + encodeURIComponent(p.tag3);
  if (p.adaptive) q += '&adaptive=1';
  if (p.real) q += '&real=1';
  return request<QuestionsResp>(q);
}

export function redoMistakes(limit = 10): Promise<QuestionsResp> {
  return request<QuestionsResp>(
    '/api/mistakes/redo?limit=' + limit + '&uid=' + encodeURIComponent(anonUid())
  );
}

// ---------- 作答上报 ----------

export function postAnswerLog(items: AnswerLogItem[]): Promise<void> {
  return request<void>('/api/answer_log', {
    method: 'POST',
    data: { uid: anonUid(), items },
  });
}

export function postPracticeResult(
  module: string,
  n: number,
  correct: number,
  secs: number
): Promise<PracticeResultResp> {
  return request<PracticeResultResp>('/api/practice_result', {
    method: 'POST',
    data: { module, n, correct, secs },
  });
}

// ---------- 错题本 ----------

export function fetchMistakes(): Promise<MistakesResp> {
  return request<MistakesResp>('/api/mistakes?uid=' + encodeURIComponent(anonUid()));
}

export function postMistake(m: {
  question_id: number | null;
  module: string;
  question_type?: string | null;
  question_text: string;
  user_answer: string;
  correct_answer: string;
  explanation?: string;
}): Promise<{ id: number }> {
  return request<{ id: number }>('/api/mistakes', {
    method: 'POST',
    data: { uid: anonUid(), ...m },
  });
}

export function patchMistake(id: number, data: Partial<Mistake>): Promise<void> {
  return request<void>('/api/mistakes/' + id, { method: 'PATCH', data });
}

export function deleteMistake(id: number): Promise<void> {
  return request<void>('/api/mistakes/' + id, { method: 'DELETE' });
}

// ---------- 收藏 ----------

export function fetchFavs(): Promise<{ items: FavItem[] }> {
  return request<{ items: FavItem[] }>('/api/favs?uid=' + encodeURIComponent(anonUid()));
}

// ---------- 账号 ----------

export function authRegister(
  phone: string,
  password: string,
  nickname: string
): Promise<AuthResp> {
  return request<AuthResp>('/api/auth/register', {
    method: 'POST',
    data: { phone, password, code: '', nickname: nickname || null },
  });
}

export function authLogin(phone: string, password: string): Promise<AuthResp> {
  return request<AuthResp>('/api/auth/login', { method: 'POST', data: { phone, password } });
}

export function authLogout(): Promise<void> {
  return request<void>('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
}

export function mergeAnon(anonUidVal: string): Promise<void> {
  return request<void>('/api/auth/merge_anon', { method: 'POST', data: { anon_uid: anonUidVal } });
}

// ---------- 计划 / 画像 ----------

export function fetchProfile(): Promise<{ profile: Profile | null }> {
  return request<{ profile: Profile | null }>(
    '/api/profile?uid=' + encodeURIComponent(anonUid())
  );
}

export function fetchPlanToday(): Promise<PlanToday> {
  return request<PlanToday>('/api/plan/today?uid=' + encodeURIComponent(anonUid()));
}

// ---------- 模考 ----------

export function fetchPapers(): Promise<{ items: Paper[] }> {
  return request<{ items: Paper[] }>('/api/papers');
}

export function fetchPaperQuestions(source: string): Promise<QuestionsResp> {
  return request<QuestionsResp>('/api/paper_questions?src=' + encodeURIComponent(source));
}
