import { request } from '../utils/request';
import { anonUid, pkNickname } from '../utils/auth';
import type {
  AnswerLogItem,
  AuthResp,
  CheckinBadgesResp,
  CheckinSummaryResp,
  ExamReportResp,
  ExamStartResp,
  ExamSubmitResp,
  FavItem,
  Mistake,
  MistakesResp,
  Paper,
  PkResultResp,
  PlanToday,
  PracticeResultResp,
  Profile,
  QuestionsResp,
  ReviewRecordResp,
  ReviewResp,
  ShareAnswerResp,
  ShareCreateResp,
  ShareDetailResp,
  TeamInfo,
  TeamPanelResp,
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

export function fetchReviewDue(): Promise<ReviewResp> {
  return request<ReviewResp>('/api/review?uid=' + encodeURIComponent(anonUid()));
}

export function postReviewRecord(mid: number, correct: boolean): Promise<ReviewRecordResp> {
  return request<ReviewRecordResp>('/api/review/' + mid, {
    method: 'POST',
    data: { uid: anonUid(), correct },
  });
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

export function examStart(): Promise<ExamStartResp> {
  return request<ExamStartResp>('/api/exam/start', {
    method: 'POST',
    data: { uid: anonUid(), mini: true },
  });
}

export function examSubmit(
  attemptId: number,
  picks: Record<number, string>,
  secs: Record<number, number>
): Promise<ExamSubmitResp> {
  return request<ExamSubmitResp>('/api/exam/submit', {
    method: 'POST',
    data: { uid: anonUid(), attempt_id: attemptId, picks, secs },
  });
}

export function fetchExamReport(attemptId: number): Promise<ExamReportResp> {
  return request<ExamReportResp>(
    '/api/exam/report/' + attemptId + '?uid=' + encodeURIComponent(anonUid())
  );
}

// ---------- 组队打卡 / 题目分享 ----------

export function teamCreate(name: string): Promise<{ team: TeamInfo }> {
  return request<{ team: TeamInfo }>('/api/team/create', {
    method: 'POST',
    data: { uid: anonUid(), nickname: pkNickname(), name },
  });
}

export function teamJoin(code: string): Promise<{ team: TeamInfo; already?: boolean }> {
  return request<{ team: TeamInfo; already?: boolean }>('/api/team/join', {
    method: 'POST',
    data: { uid: anonUid(), nickname: pkNickname(), code },
  });
}

export function teamLeave(teamId: number): Promise<void> {
  return request<void>('/api/team/leave', {
    method: 'POST',
    data: { uid: anonUid(), team_id: teamId },
  });
}

export function teamMine(): Promise<{ items: TeamInfo[] }> {
  return request<{ items: TeamInfo[] }>('/api/team/mine?uid=' + encodeURIComponent(anonUid()));
}

export function teamPanel(teamId: number): Promise<TeamPanelResp> {
  return request<TeamPanelResp>(
    '/api/team/' + teamId + '/panel?uid=' + encodeURIComponent(anonUid())
  );
}

export function shareCreate(
  questionId: number,
  teamId?: number | null
): Promise<ShareCreateResp> {
  return request<ShareCreateResp>('/api/share/create', {
    method: 'POST',
    data: { uid: anonUid(), nickname: pkNickname(), question_id: questionId, team_id: teamId || null },
  });
}

export function shareDetail(sid: string): Promise<ShareDetailResp> {
  return request<ShareDetailResp>(
    '/api/share/' + encodeURIComponent(sid) + '?uid=' + encodeURIComponent(anonUid())
  );
}

export function shareAnswer(sid: string, picked: string, secs: number): Promise<ShareAnswerResp> {
  return request<ShareAnswerResp>('/api/share/' + encodeURIComponent(sid) + '/answer', {
    method: 'POST',
    data: { uid: anonUid(), nickname: pkNickname(), picked, secs: secs || 0 },
  });
}

// ---------- 打卡徽章 / PK 战绩 ----------

export function fetchCheckinSummary(): Promise<CheckinSummaryResp> {
  return request<CheckinSummaryResp>(
    '/api/checkin/summary?uid=' + encodeURIComponent(anonUid())
  );
}

export function fetchCheckinBadges(): Promise<CheckinBadgesResp> {
  return request<CheckinBadgesResp>(
    '/api/checkin/badges?uid=' + encodeURIComponent(anonUid())
  );
}

export function pkResult(code: string): Promise<PkResultResp> {
  return request<PkResultResp>('/api/pk/result/' + encodeURIComponent(code));
}

export function trackEvent(
  event: string,
  source?: string | null,
  ref?: string | null
): Promise<void> {
  return request<void>('/api/track', {
    method: 'POST',
    data: { uid: anonUid(), event, source: source || null, ref: ref || null },
  }).catch(() => undefined);
}
