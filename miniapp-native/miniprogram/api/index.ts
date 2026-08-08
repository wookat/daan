import { BASE_URL, request } from '../utils/request';
import { anonUid, getAccessCode, getToken } from '../utils/auth';
import type {
  AnswerLogItem,
  AuthResp,
  CheckinSummary,
  ContestReport,
  ExamPaper,
  ExamPapersResp,
  ExamAttempt,
  ExamRankResp,
  ExamReport,
  ExamStartResp,
  ExamSubmitResp,
  FavFolder,
  FavFull,
  FavItem,
  MasteryMapResp,
  Mistake,
  MistakesResp,
  MockEventsResp,
  NoteItem,
  Paper,
  PlanToday,
  PracticeResultResp,
  PredictResp,
  Profile,
  QuestionsResp,
  SearchQuestionDetail,
  SearchResp,
  WeeklyReport,
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

export function saveProfile(pf: Profile): Promise<{ profile: Profile }> {
  return request<{ profile: Profile }>('/api/profile', {
    method: 'POST',
    data: { uid: anonUid(), ...pf },
  });
}

// ---------- 整卷模考 ----------

export function fetchExamPapers(
  year?: number | null,
  region?: string | null
): Promise<ExamPapersResp> {
  let q = '/api/exam/papers?kind=zhenti&uid=' + encodeURIComponent(anonUid());
  if (year) q += '&year=' + year;
  if (region) q += '&region=' + encodeURIComponent(region);
  return request<ExamPapersResp>(q);
}

export function fetchExamPaperDetail(id: number): Promise<{ paper: ExamPaper }> {
  return request<{ paper: ExamPaper }>('/api/exam/papers/' + id);
}

export function fetchExamAttempts(
  paperId?: number | null,
  limit = 10
): Promise<{ items: ExamAttempt[] }> {
  let q = '/api/exam/attempts?uid=' + encodeURIComponent(anonUid()) + '&limit=' + limit;
  if (paperId) q += '&paper_id=' + paperId;
  return request<{ items: ExamAttempt[] }>(q);
}

export function examStart(opt: { paper_id?: number; mini?: boolean }): Promise<ExamStartResp> {
  const data = opt.mini
    ? { uid: anonUid(), mini: true }
    : { uid: anonUid(), paper_id: opt.paper_id };
  return request<ExamStartResp>('/api/exam/start', { method: 'POST', data });
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

export function fetchExamReport(attemptId: number): Promise<ExamReport> {
  return request<ExamReport>(
    '/api/exam/report/' + attemptId + '?uid=' + encodeURIComponent(anonUid())
  );
}

export function fetchExamRank(attemptId: number): Promise<ExamRankResp> {
  return request<ExamRankResp>(
    '/api/exam/rank/' + attemptId + '?uid=' + encodeURIComponent(anonUid())
  );
}

// ---------- 模考大赛 ----------

export function fetchMockEvents(): Promise<MockEventsResp> {
  return request<MockEventsResp>('/api/mock/events?uid=' + encodeURIComponent(anonUid()));
}

export function mockRegister(eventId: number): Promise<void> {
  return request<void>('/api/mock/events/' + eventId + '/register', {
    method: 'POST',
    data: { uid: anonUid() },
  });
}

export function mockEnter(eventId: number): Promise<{ paper_id: number }> {
  return request<{ paper_id: number }>('/api/mock/events/' + eventId + '/enter', {
    method: 'POST',
    data: { uid: anonUid() },
  });
}

export function mockAttach(eventId: number, attemptId: number): Promise<void> {
  return request<void>('/api/mock/events/' + eventId + '/attach', {
    method: 'POST',
    data: { uid: anonUid(), attempt_id: attemptId },
  });
}

export function fetchContestReport(eventId: number): Promise<ContestReport> {
  return request<ContestReport>(
    '/api/mock/events/' + eventId + '/report?uid=' + encodeURIComponent(anonUid())
  );
}

// ---------- 统计 ----------

export function fetchMasteryMap(): Promise<MasteryMapResp> {
  return request<MasteryMapResp>('/api/mastery/map?uid=' + encodeURIComponent(anonUid()));
}

export function fetchWeeklyReport(week?: string): Promise<WeeklyReport> {
  let q = '/api/report/weekly?uid=' + encodeURIComponent(anonUid());
  if (week) q += '&week=' + week;
  return request<WeeklyReport>(q);
}

export function markWeeklyRead(week: string): Promise<void> {
  return request<void>('/api/report/weekly/read', {
    method: 'POST',
    data: { uid: anonUid(), week },
  });
}

export function fetchPredict(): Promise<PredictResp> {
  return request<PredictResp>('/api/predict?uid=' + encodeURIComponent(anonUid()));
}

export function fetchCheckinSummary(): Promise<CheckinSummary> {
  return request<CheckinSummary>('/api/checkin/summary?uid=' + encodeURIComponent(anonUid()));
}

// ---------- 搜索 ----------

export function search(q: string, type = 'all', offset = 0): Promise<SearchResp> {
  let p = '/api/search?q=' + encodeURIComponent(q) + '&type=' + type;
  if (offset) p += '&offset=' + offset;
  return request<SearchResp>(p);
}

export function fetchSearchQuestion(id: number): Promise<SearchQuestionDetail> {
  return request<SearchQuestionDetail>('/api/search/question/' + id);
}

// ---------- 收藏夹 / 笔记 ----------

export function fetchFavFolders(): Promise<{ items: FavFolder[] }> {
  return request<{ items: FavFolder[] }>('/api/favs/folders?uid=' + encodeURIComponent(anonUid()));
}

export function createFavFolder(name: string, icon?: string): Promise<void> {
  return request<void>('/api/favs/folders', {
    method: 'POST',
    data: { uid: anonUid(), name, icon: icon || null },
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

export function fetchFavsFull(): Promise<{ items: FavFull[] }> {
  return request<{ items: FavFull[] }>('/api/favs?uid=' + encodeURIComponent(anonUid()));
}

export function setFav(questionId: number, folderId?: number | null): Promise<void> {
  return request<void>('/api/favs', {
    method: 'POST',
    data: { uid: anonUid(), question_id: questionId, folder_id: folderId || null },
  });
}

export function removeFav(questionId: number): Promise<void> {
  return request<void>(
    '/api/favs?uid=' + encodeURIComponent(anonUid()) + '&question_id=' + questionId,
    { method: 'DELETE' }
  );
}

export function fetchNotes(): Promise<{ items: NoteItem[] }> {
  return request<{ items: NoteItem[] }>('/api/notes?uid=' + encodeURIComponent(anonUid()));
}

// ---------- PDF 导出 ----------

export interface ExportPdfBody {
  title: string;
  question_ids: number[];
  include_answers?: boolean;
  answer_sheet?: boolean;
  include_questions?: boolean;
}

// POST 拿 arraybuffer → 落地本地文件 → 系统预览打开（与 frontend-uni exportPdf 小程序分支对齐）
export async function exportPdf(body: ExportPdfBody): Promise<void> {
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Access-Code': getAccessCode(),
  };
  const t = getToken();
  if (t) header.Authorization = 'Bearer ' + t;
  const res = await new Promise<WechatMiniprogram.RequestSuccessCallbackResult>(
    (resolve, reject) => {
      wx.request({
        url: BASE_URL + '/api/export/pdf',
        method: 'POST',
        data: body,
        header,
        responseType: 'arraybuffer',
        timeout: 120000,
        success: resolve,
        fail: (err) => reject(new Error(err.errMsg || '网络错误')),
      });
    }
  );
  if (res.statusCode < 200 || res.statusCode >= 300) throw new Error('HTTP ' + res.statusCode);
  const fs = wx.getFileSystemManager();
  const filePath = `${wx.env.USER_DATA_PATH}/paper-${Date.now()}.pdf`;
  await new Promise<void>((resolve, reject) => {
    fs.writeFile({
      filePath,
      data: res.data as ArrayBuffer,
      success: () => resolve(),
      fail: (e) => reject(new Error(e.errMsg || '写入失败')),
    });
  });
  await new Promise<void>((resolve, reject) => {
    wx.openDocument({
      filePath,
      fileType: 'pdf',
      showMenu: true,
      success: () => resolve(),
      fail: (e) => reject(new Error(e.errMsg || '打开 PDF 失败')),
    });
  });
}
