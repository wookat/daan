// Exam 组 API（真题卷库 / 全真模考 / 报告 / 模考大赛 / 申论）
// 路径与参数逐条对照 frontend-uni/src/pkgA/exam/*.vue、pkgA/shenlun/shenlun.vue；旧的 examStart/examSubmit 等仍在 ./index
import { BASE_URL, request } from '../utils/request';
import { anonUid, getAccessCode, getToken, pkNickname } from '../utils/auth';
import type { ExamStartResp, ExamSubmitResp, QuestionsResp } from './types';
import type {
  ExamAttemptsResp,
  ExamExcl,
  ExamPaperDetail,
  ExamPaperFilters,
  ExamPapersResp,
  ExamPicks,
  ExamRankFull,
  ExamReportFull,
  ExamResumeResp,
  ExamSecs,
  ExportPdfBody,
  ExportPdfResult,
  MockAttachResp,
  MockEnterResp,
  MockEventsResp,
  MockRankResp,
  MockReportResp,
  PaperAnswersBody,
  PaperAnswersResp,
  PredictResp,
  ShenlunDraftResp,
  ShenlunFilters,
  ShenlunGradeResp,
  ShenlunHistoryItem,
  ShenlunHotspotsResp,
  ShenlunListResp,
  ShenlunNote,
  ShenlunMatFavsResp,
  ShenlunMaterial,
  ShenlunQFavsResp,
  ShenlunQuestion,
  ShenlunQuestionDetail,
  ShenlunStats,
} from './exam-types';

const uidQ = (): string => 'uid=' + encodeURIComponent(anonUid());

// ---------- 真题卷库 ----------

export interface ExamPapersParams {
  kind?: string;
  year?: number | string;
  region?: string;
}

export function fetchExamPapers(p: ExamPapersParams = {}): Promise<ExamPapersResp> {
  const q = ['kind=' + (p.kind || 'zhenti'), uidQ()];
  if (p.year) q.push('year=' + p.year);
  if (p.region) q.push('region=' + encodeURIComponent(p.region));
  return request<ExamPapersResp>('/api/exam/papers?' + q.join('&'));
}

export function fetchRealFilters(): Promise<ExamPaperFilters> {
  return request<ExamPaperFilters>('/api/real_filters');
}

export function fetchExamPaperDetail(pid: number): Promise<{ paper: ExamPaperDetail }> {
  return request<{ paper: ExamPaperDetail }>('/api/exam/papers/' + pid);
}

export function fetchPaperQuestionsById(pid: number, src?: string | null): Promise<QuestionsResp> {
  const q = ['pid=' + pid, uidQ()];
  if (src) q.push('src=' + encodeURIComponent(src));
  return request<QuestionsResp>('/api/paper_questions?' + q.join('&'));
}

export function postPaperAnswers(body: Omit<PaperAnswersBody, 'uid'>): Promise<PaperAnswersResp> {
  return request<PaperAnswersResp>('/api/paper_answers', {
    method: 'POST',
    data: { uid: anonUid(), ...body },
  });
}

// ---------- 全真模考 ----------

export function examStartPaper(paperId: number): Promise<ExamStartResp> {
  return request<ExamStartResp>('/api/exam/start', {
    method: 'POST',
    data: { uid: anonUid(), paper_id: paperId },
  });
}

export function examStartMini(): Promise<ExamStartResp> {
  return request<ExamStartResp>('/api/exam/start', {
    method: 'POST',
    data: { uid: anonUid(), mini: true },
  });
}

// ---------- 卷型模板组卷（B4）+ 拍照判分（B5） ----------

export interface ExamTemplate {
  id: string;
  name: string;
  n: number;
  duration_min: number;
  note: string;
}

export function fetchExamTemplates(): Promise<{ items: ExamTemplate[] }> {
  return request<{ items: ExamTemplate[] }>('/api/exam/templates');
}

export function examStartTemplate(templateId: string, weakBoost: boolean): Promise<ExamStartResp> {
  return request<ExamStartResp>('/api/exam/start', {
    method: 'POST',
    data: { uid: anonUid(), template_id: templateId, weak_boost: weakBoost },
  });
}

// /api/scan_sheet 返回行比 learn.ts PaperAnswerRow 少 module/secs（判分页也只用到 no/picked/answer/correct/status）
export interface ScanSheetResp {
  code: string;
  title?: string | null;
  total: number;
  answered: number;
  correct: number;
  saved: boolean;
  page?: number;
  pages?: number;
  items: Array<{ no: number; question_id?: number | null; picked: string; answer: string; correct: boolean; status: string; question?: string }>;
}

// /api/scan_sheet 是 multipart：与 social.ts uploadExplain 同模式走 wx.uploadFile
export function scanSheet(filePath: string): Promise<ScanSheetResp> {
  return new Promise<ScanSheetResp>((resolve, reject) => {
    const header: Record<string, string> = { 'X-Access-Code': getAccessCode() };
    const token = getToken();
    if (token) header.Authorization = 'Bearer ' + token;
    wx.uploadFile({
      url: BASE_URL + '/api/scan_sheet',
      filePath,
      name: 'image',
      formData: { uid: anonUid() },
      header,
      timeout: 120000,
      success: (res) => {
        try {
          const data = JSON.parse(res.data) as ScanSheetResp & { detail?: string };
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
          else reject(new Error(data.detail || `HTTP ${res.statusCode}`));
        } catch (e) {
          reject(e as Error);
        }
      },
      fail: (err) => reject(new Error(err.errMsg || '上传失败')),
    });
  });
}

export interface ExamProgressPayload {
  picks: ExamPicks;
  idx: number;
  marks: number[];
  secs: ExamSecs;
  excl: ExamExcl;
}

export function examProgress(attemptId: number, p: ExamProgressPayload): Promise<void> {
  return request<void>('/api/exam/progress', {
    method: 'POST',
    data: { uid: anonUid(), attempt_id: attemptId, ...p },
  });
}

export function examProgressDrop(attemptId: number): Promise<void> {
  return request<void>('/api/exam/progress', {
    method: 'POST',
    data: { uid: anonUid(), attempt_id: attemptId, drop: true },
  });
}

export function examResume(): Promise<ExamResumeResp | null> {
  return request<ExamResumeResp | null>('/api/exam/resume?' + uidQ());
}

// 与 H5 一致：题号从 1 开始；20s 超时，失败后由页面先查 report 再决定重交
export function examSubmitFull(
  attemptId: number,
  picks: Record<number, string>,
  secs: Record<number, number>,
  marks: number[]
): Promise<ExamSubmitResp> {
  return request<ExamSubmitResp>('/api/exam/submit', {
    method: 'POST',
    data: { uid: anonUid(), attempt_id: attemptId, picks, secs, marks },
    timeout: 20000,
  });
}

export function fetchExamAttempts(paperId?: number | null, limit?: number): Promise<ExamAttemptsResp> {
  return request<ExamAttemptsResp>(
    '/api/exam/attempts?' + uidQ() + (paperId ? '&paper_id=' + paperId : '') + (limit ? '&limit=' + limit : '')
  );
}

export function fetchExamReportQuick(attemptId: number, timeout = 8000): Promise<ExamReportFull> {
  return request<ExamReportFull>('/api/exam/report/' + attemptId + '?' + uidQ(), { timeout });
}

export function fetchExamRankQuick(attemptId: number): Promise<ExamRankFull> {
  return request<ExamRankFull>('/api/exam/rank/' + attemptId + '?' + uidQ());
}

export function addFav(questionId: number): Promise<void> {
  return request<void>('/api/favs', { method: 'POST', data: { uid: anonUid(), question_id: questionId, folder_id: null } });
}

export function fetchPredict(): Promise<PredictResp> {
  return request<PredictResp>('/api/predict?' + uidQ());
}

// ---------- PDF 导出 ----------
// /api/export/pdf 是 POST 返回二进制；wx.downloadFile 只支持 GET（DownloadFileOption 无 method），
// 故与 H5 MP-WEIXIN 分支一致：wx.request(arraybuffer) → FileSystemManager.writeFile → wx.openDocument。

export function exportPdf(body: ExportPdfBody): Promise<ExportPdfResult> {
  return new Promise<ExportPdfResult>((resolve, reject) => {
    const header: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Access-Code': getAccessCode(),
    };
    const token = getToken();
    if (token) header.Authorization = 'Bearer ' + token;
    wx.request({
      url: BASE_URL + '/api/export/pdf',
      method: 'POST',
      data: { ...body, uid: anonUid() },
      header,
      responseType: 'arraybuffer',
      timeout: 120000,
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error('HTTP ' + res.statusCode));
          return;
        }
        const h = (res.header || {}) as Record<string, string>;
        const code = String(h['X-Paper-Code'] || h['x-paper-code'] || '');
        rememberPaper(code, body.title);
        const filePath = wx.env.USER_DATA_PATH + '/paper-' + Date.now() + '.pdf';
        wx.getFileSystemManager().writeFile({
          filePath,
          data: res.data as ArrayBuffer,
          success: () => {
            wx.openDocument({
              filePath,
              fileType: 'pdf',
              showMenu: true,
              success: () => resolve({ filePath, code }),
              fail: (e) => reject(new Error(e.errMsg || '打开失败')),
            });
          },
          fail: (e) => reject(new Error(e.errMsg || '写入失败')),
        });
      },
      fail: (err) => reject(new Error(err.errMsg || '网络错误')),
    });
  });
}

export interface RecentPaper {
  code: string;
  title: string;
  ts: number;
}

function rememberPaper(code: string, title: string): void {
  if (!code) return;
  const prev = (wx.getStorageSync('recentPapers') || []) as RecentPaper[];
  const list = prev.filter((p) => p.code !== code);
  list.unshift({ code, title: title || '试卷', ts: Date.now() });
  wx.setStorageSync('recentPapers', list.slice(0, 10));
}

// ---------- 模考大赛 ----------

export function fetchMockEvents(): Promise<MockEventsResp> {
  return request<MockEventsResp>('/api/mock/events?' + uidQ());
}

export function mockRegister(eventId: number): Promise<void> {
  return request<void>('/api/mock/events/' + eventId + '/register', {
    method: 'POST',
    data: { uid: anonUid(), nickname: pkNickname() },
  });
}

export function mockEnter(eventId: number): Promise<MockEnterResp> {
  return request<MockEnterResp>('/api/mock/events/' + eventId + '/enter', {
    method: 'POST',
    data: { uid: anonUid(), nickname: pkNickname() },
  });
}

export function mockAttach(eventId: number, attemptId: number): Promise<MockAttachResp> {
  return request<MockAttachResp>('/api/mock/events/' + eventId + '/attach', {
    method: 'POST',
    data: { uid: anonUid(), attempt_id: attemptId },
  });
}

export function fetchMockRank(eventId: number): Promise<MockRankResp> {
  return request<MockRankResp>('/api/mock/events/' + eventId + '/rank?' + uidQ());
}

export function fetchMockReport(eventId: number): Promise<MockReportResp> {
  return request<MockReportResp>('/api/mock/events/' + eventId + '/report?' + uidQ());
}

// ---------- 申论 ----------

export interface ShenlunQuestionsParams {
  qtype?: string;
  year?: number;
  region?: string;
  paper?: string;
  offset?: number;
  limit?: number;
}

export function fetchShenlunQuestions(p: ShenlunQuestionsParams): Promise<ShenlunListResp<ShenlunQuestion>> {
  let q = '/api/shenlun/questions?limit=' + (p.limit || 20) + '&offset=' + (p.offset || 0);
  if (p.qtype && p.qtype !== '全部') q += '&qtype=' + encodeURIComponent(p.qtype);
  if (p.year) q += '&year=' + p.year;
  if (p.region) q += '&region=' + encodeURIComponent(p.region);
  if (p.paper) q += '&paper=' + encodeURIComponent(p.paper);
  return request<ShenlunListResp<ShenlunQuestion>>(q);
}

export function fetchShenlunQuestion(qid: number): Promise<{ item: ShenlunQuestionDetail }> {
  return request<{ item: ShenlunQuestionDetail }>('/api/shenlun/questions/' + qid);
}

export function fetchShenlunMaterials(p: {
  type?: string;
  offset?: number;
  limit?: number;
  id?: number;
}): Promise<ShenlunListResp<ShenlunMaterial>> {
  if (p.id) return request<ShenlunListResp<ShenlunMaterial>>('/api/shenlun/materials?id=' + p.id);
  let q = '/api/shenlun/materials?limit=' + (p.limit || 20) + '&offset=' + (p.offset || 0);
  if (p.type && p.type !== '全部') q += '&type=' + encodeURIComponent(p.type);
  return request<ShenlunListResp<ShenlunMaterial>>(q);
}

export function fetchShenlunFilters(): Promise<ShenlunFilters> {
  return request<ShenlunFilters>('/api/shenlun/filters');
}

export function fetchShenlunHotspots(p: { offset?: number; limit?: number } = {}): Promise<ShenlunHotspotsResp> {
  return request<ShenlunHotspotsResp>('/api/shenlun/hotspots?limit=' + (p.limit || 30) + '&offset=' + (p.offset || 0));
}

export function fetchShenlunNotes(): Promise<{ items: ShenlunNote[] }> {
  return request<{ items: ShenlunNote[] }>('/api/shenlun/notes?' + uidQ());
}

export function saveShenlunNote(p: { id?: number; topic?: string; title?: string; content: string }): Promise<{ id: number; updated: boolean }> {
  return request<{ id: number; updated: boolean }>('/api/shenlun/notes', {
    method: 'POST',
    data: { uid: anonUid(), ...p },
  });
}

export function delShenlunNote(id: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/shenlun/notes/delete', {
    method: 'POST',
    data: { uid: anonUid(), id },
  });
}

export function fetchShenlunDraft(qid: number): Promise<ShenlunDraftResp> {
  return request<ShenlunDraftResp>('/api/shenlun/draft?' + uidQ() + '&qid=' + qid);
}

export function saveShenlunDraft(qid: number, content: string): Promise<void> {
  return request<void>('/api/shenlun/draft', {
    method: 'POST',
    data: { uid: anonUid(), qid, content },
  });
}

export function shenlunGrade(qid: number, answer: string): Promise<ShenlunGradeResp> {
  return request<ShenlunGradeResp>('/api/shenlun/grade', {
    method: 'POST',
    data: { qid, answer, uid: anonUid() },
    timeout: 90000,
  });
}

export function fetchShenlunHistory(qid?: number | null, limit = 20): Promise<{ items: ShenlunHistoryItem[] }> {
  let q = '/api/shenlun/history?limit=' + limit + '&' + uidQ();
  if (qid) q += '&qid=' + qid;
  return request<{ items: ShenlunHistoryItem[] }>(q);
}

export function fetchShenlunStats(): Promise<ShenlunStats> {
  return request<ShenlunStats>('/api/shenlun/stats?' + uidQ());
}

export function fetchShenlunQFavs(): Promise<ShenlunQFavsResp> {
  return request<ShenlunQFavsResp>('/api/shenlun/qfavs?' + uidQ());
}

export function setShenlunQFav(qid: number, on: boolean): Promise<void> {
  return request<void>('/api/shenlun/qfavs', { method: 'POST', data: { uid: anonUid(), qid, on } });
}

export function fetchShenlunMatFavs(): Promise<ShenlunMatFavsResp> {
  return request<ShenlunMatFavsResp>('/api/shenlun/mat_favs?' + uidQ());
}

export function setShenlunMatFav(mid: number, on: boolean): Promise<void> {
  return request<void>('/api/shenlun/mat_favs', { method: 'POST', data: { uid: anonUid(), mid, on } });
}
