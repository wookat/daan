import { request } from '../utils/request';
import { anonUid, pkNickname } from '../utils/auth';
import type {
  AnswerLogItem,
  AuthResp,
  CheckinBadgesResp,
  CheckinSummaryResp,
  ExamAttemptItem,
  ExamPapersResp,
  ExamReportResp,
  ExamRankResp,
  ExamStartResp,
  ExamSubmitResp,
  FavFolder,
  FavItem,
  GrowthResp,
  Mistake,
  MistakesResp,
  NoteItem,
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

export function fetchQuestionCounts(): Promise<{ counts: { module: string; n: number }[] }> {
  return request<{ counts: { module: string; n: number }[] }>('/api/question_counts');
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
    data: { uid: anonUid(), module, n, correct, secs },
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
  return request<void>('/api/mistakes/' + id, { method: 'PATCH', data: { uid: anonUid(), ...data } });
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
  return request<void>(
    '/api/mistakes/' + id + '?uid=' + encodeURIComponent(anonUid()),
    { method: 'DELETE' }
  );
}

// ---------- 收藏 ----------

export function fetchFavs(folderId?: number | null): Promise<{ items: FavItem[] }> {
  let q = '/api/favs?uid=' + encodeURIComponent(anonUid());
  if (folderId != null) q += '&folder_id=' + folderId;
  return request<{ items: FavItem[] }>(q);
}

export function fetchFavFolders(): Promise<{ items: FavFolder[] }> {
  return request<{ items: FavFolder[] }>(
    '/api/favs/folders?uid=' + encodeURIComponent(anonUid())
  );
}

export function createFavFolder(name: string): Promise<{ id: number }> {
  return request<{ id: number }>('/api/favs/folders', {
    method: 'POST',
    data: { uid: anonUid(), name },
  });
}

export function renameFavFolder(fid: number, name: string): Promise<void> {
  return request<void>('/api/favs/folders/' + fid, {
    method: 'PATCH',
    data: { uid: anonUid(), name },
  });
}

export function deleteFavFolder(fid: number): Promise<void> {
  return request<void>(
    '/api/favs/folders/' + fid + '?uid=' + encodeURIComponent(anonUid()),
    { method: 'DELETE' }
  );
}

export function deleteFav(questionId: number): Promise<void> {
  return request<void>(
    '/api/favs?uid=' + encodeURIComponent(anonUid()) + '&question_id=' + questionId,
    { method: 'DELETE' }
  );
}

// ---------- 笔记 / 纠错 ----------

export function fetchNote(
  questionId: number
): Promise<{ item: { content: string; updated_at: number } | null }> {
  return request<{ item: { content: string; updated_at: number } | null }>(
    '/api/notes?uid=' + encodeURIComponent(anonUid()) + '&question_id=' + questionId
  );
}

export function fetchNotes(): Promise<{ items: NoteItem[] }> {
  return request<{ items: NoteItem[] }>('/api/notes?uid=' + encodeURIComponent(anonUid()));
}

export function saveNote(questionId: number, content: string): Promise<void> {
  return request<void>('/api/notes', {
    method: 'POST',
    data: { uid: anonUid(), question_id: questionId, content },
  });
}

export function postQuestionReport(
  questionId: number,
  rtype: string,
  detail: string
): Promise<void> {
  return request<void>('/api/question_report', {
    method: 'POST',
    data: { uid: anonUid(), question_id: questionId, type: rtype, detail },
  });
}

// ---------- 学习提醒 ----------

export function setReminder(channel: 'wxsub' | 'web', enabled: boolean, hour?: number): Promise<void> {
  return request<void>('/api/reminders', {
    method: 'POST',
    data: { uid: anonUid(), channel, enabled, hour },
  });
}

export function fetchReminders(): Promise<{ items: { channel: string; enabled: number; hour: number | null }[] }> {
  return request<{ items: { channel: string; enabled: number; hour: number | null }[] }>(
    '/api/reminders?uid=' + encodeURIComponent(anonUid())
  );
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

export function authWxLogin(code: string, nickname?: string): Promise<AuthResp> {
  return request<AuthResp>('/api/auth/wxlogin', {
    method: 'POST',
    data: { code, nickname: nickname || null },
  });
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

export function saveProfile(pf: Profile): Promise<{ profile: Profile }> {
  return request<{ profile: Profile }>('/api/profile', {
    method: 'POST',
    data: { uid: anonUid(), ...pf },
  });
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

export function fetchExamPapers(p: { year?: number | null; region?: string | null } = {}): Promise<ExamPapersResp> {
  let q = '/api/exam/papers?kind=zhenti&uid=' + encodeURIComponent(anonUid());
  if (p.year) q += '&year=' + p.year;
  if (p.region) q += '&region=' + encodeURIComponent(p.region);
  return request<ExamPapersResp>(q);
}

export function fetchExamAttempts(limit = 10): Promise<{ items: ExamAttemptItem[] }> {
  return request<{ items: ExamAttemptItem[] }>(
    '/api/exam/attempts?limit=' + limit + '&uid=' + encodeURIComponent(anonUid())
  );
}

/** 不传 paperId = 迷你模考（30 题混合）；传 paperId = 整卷全真模考 */
export function examStart(paperId?: number): Promise<ExamStartResp> {
  return request<ExamStartResp>('/api/exam/start', {
    method: 'POST',
    data: paperId ? { uid: anonUid(), paper_id: paperId } : { uid: anonUid(), mini: true },
  });
}

/** 服务端保存作答进度（picks/secs 以 question_id 为键，与 H5 同口径） */
export function examProgress(
  attemptId: number,
  picks: Record<number, string>,
  idx: number,
  secs: Record<number, number>
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/exam/progress', {
    method: 'POST',
    data: { uid: anonUid(), attempt_id: attemptId, picks, idx, secs },
  });
}

/** 交卷：picks/secs 以 1 起始题号为键（服务端判分口径） */
export function examSubmit(
  attemptId: number,
  picks: Record<number, string>,
  secs: Record<number, number>,
  timeout?: number
): Promise<ExamSubmitResp> {
  return request<ExamSubmitResp>('/api/exam/submit', {
    method: 'POST',
    data: { uid: anonUid(), attempt_id: attemptId, picks, secs },
    timeout,
  });
}

export function fetchExamReport(attemptId: number, timeout?: number): Promise<ExamReportResp> {
  return request<ExamReportResp>(
    '/api/exam/report/' + attemptId + '?uid=' + encodeURIComponent(anonUid()),
    { timeout }
  );
}

export function fetchExamRank(attemptId: number): Promise<ExamRankResp> {
  return request<ExamRankResp>(
    '/api/exam/rank/' + attemptId + '?uid=' + encodeURIComponent(anonUid())
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

export function fetchGrowth(): Promise<GrowthResp> {
  return request<GrowthResp>('/api/growth?uid=' + encodeURIComponent(anonUid()));
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
