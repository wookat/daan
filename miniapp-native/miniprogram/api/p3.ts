// 三期 API：AI 问答 / 面试 / PK / 时政 / 申论 / 讨论 / 纠错
import { BASE_URL, request } from '../utils/request';
import { anonUid, getAccessCode, getAuthUser, getToken } from '../utils/auth';

function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: 'Bearer ' + t } : {};
}

// ---------- AI 问答（讲解） ----------

export interface ExplainMeta {
  module: string | null;
  module_name: string | null;
  question_type: string | null;
  question_text: string;
  user_answer: string | null;
  explain_key: string;
  cached?: boolean;
}

export interface ExplainResp extends ExplainMeta {
  explanation: string;
}

export function fetchAccessInfo(): Promise<{ required: boolean }> {
  return request<{ required: boolean }>('/api/access_info').catch(() => ({ required: false }));
}

// 图片题：uploadFile 一次性返回（小程序无法分块上传图片表单）
export function uploadExplain(opt: {
  filePath?: string | null;
  text?: string | null;
  userAnswer?: string | null;
}): Promise<ExplainResp> {
  const formData: Record<string, string> = {};
  if (opt.text) formData.text = opt.text;
  if (opt.userAnswer) formData.user_answer = opt.userAnswer;
  if (opt.filePath) {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: BASE_URL + '/api/explain',
        filePath: opt.filePath as string,
        name: 'image',
        formData,
        header: { 'X-Access-Code': getAccessCode(), ...authHeader() },
        timeout: 180000,
        success: (res) => {
          try {
            const data = JSON.parse(res.data) as ExplainResp & { detail?: string };
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
  return request<ExplainResp>('/api/explain', {
    method: 'POST',
    header: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: encodeForm(formData),
  });
}

function encodeForm(o: Record<string, string>): string {
  return Object.keys(o)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(o[k]))
    .join('&');
}

// 增量 UTF-8 解码（小程序无 TextDecoder，需处理跨 chunk 的多字节截断）
function makeUtf8Decoder(): (buf: ArrayBuffer) => string {
  let pending: number[] = [];
  return function decode(arrayBuffer: ArrayBuffer): string {
    const all = pending.concat(Array.from(new Uint8Array(arrayBuffer)));
    let end = all.length;
    for (let i = all.length - 1, k = 0; i >= 0 && k < 4; i--, k++) {
      const b = all[i];
      if (b < 0x80) break;
      if (b >= 0xc0) {
        const need = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : 2;
        if (all.length - i < need) end = i;
        break;
      }
    }
    pending = all.slice(end);
    let s = '';
    for (let i = 0; i < end; ) {
      const b = all[i];
      if (b < 0x80) {
        s += String.fromCharCode(b);
        i += 1;
      } else if (b >= 0xf0) {
        s += String.fromCodePoint(
          ((b & 0x07) << 18) | ((all[i + 1] & 0x3f) << 12) | ((all[i + 2] & 0x3f) << 6) | (all[i + 3] & 0x3f)
        );
        i += 4;
      } else if (b >= 0xe0) {
        s += String.fromCharCode(((b & 0x0f) << 12) | ((all[i + 1] & 0x3f) << 6) | (all[i + 2] & 0x3f));
        i += 3;
      } else {
        s += String.fromCharCode(((b & 0x1f) << 6) | (all[i + 1] & 0x3f));
        i += 2;
      }
    }
    return s;
  };
}

interface SseState {
  buf: string;
  full: string;
  meta: ExplainMeta | null;
}

// SSE 文本 → 事件回调（与 frontend-uni feedSse 对齐）
function feedSse(
  chunkText: string,
  state: SseState,
  onMeta?: (m: ExplainMeta) => void,
  onDelta?: (full: string) => void
): void {
  state.buf += chunkText;
  const events = state.buf.split('\n\n');
  state.buf = events.pop() || '';
  for (const ev of events) {
    const typeM = ev.match(/^event: (\w+)/m);
    const dataM = ev.match(/^data: (.*)$/m);
    if (!dataM) continue;
    const type = typeM ? typeM[1] : 'message';
    const data = JSON.parse(dataM[1]) as ExplainMeta & { message?: string; d?: string };
    if (type === 'meta') {
      state.meta = data;
      if (onMeta) onMeta(data);
    } else if (type === 'error') {
      throw new Error(data.message || '生成失败');
    } else if (type === 'message') {
      state.full += data.d || '';
      if (onDelta) onDelta(state.full);
    }
  }
}

// 文字题走分块流式（enableChunked）；图片题降级为一次性 /api/explain
export function streamExplain(opt: {
  filePath?: string | null;
  text?: string | null;
  userAnswer?: string | null;
  onMeta?: (m: ExplainMeta) => void;
  onDelta?: (full: string) => void;
}): Promise<ExplainResp> {
  if (opt.filePath || !opt.text) {
    return uploadExplain(opt).then((d) => {
      if (opt.onMeta) opt.onMeta(d);
      if (opt.onDelta) opt.onDelta(d.explanation || '');
      return d;
    });
  }
  const formBody: Record<string, string> = { text: opt.text };
  if (opt.userAnswer) formBody.user_answer = opt.userAnswer;
  return new Promise<ExplainResp>((resolve, reject) => {
    const state: SseState = { buf: '', full: '', meta: null };
    const finish = () => {
      if (!state.meta) reject(new Error('生成失败：无响应'));
      else resolve({ ...state.meta, explanation: state.full });
    };
    const task = wx.request({
      url: BASE_URL + '/api/explain/stream',
      method: 'POST',
      header: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Access-Code': getAccessCode(),
        ...authHeader(),
      },
      data: encodeForm(formBody),
      enableChunked: true,
      timeout: 180000,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) finish();
        else reject(new Error('HTTP ' + res.statusCode));
      },
      fail: (err) => reject(new Error(err.errMsg || '网络错误')),
    });
    const decode = makeUtf8Decoder();
    if (task && task.onChunkReceived) {
      task.onChunkReceived((r) => {
        try {
          feedSse(decode(r.data), state, opt.onMeta, opt.onDelta);
        } catch (e) {
          reject(e as Error);
        }
      });
    }
  });
}

export function postFollowup(body: {
  question_text: string;
  explanation: string;
  history: Array<{ role: string; content: string }>;
  query: string;
}): Promise<{ answer: string }> {
  return request<{ answer: string }>('/api/followup', { method: 'POST', data: body });
}

export function rateExplain(key: string, up: boolean): Promise<void> {
  return request<void>('/api/rate', { method: 'POST', data: { key, up } });
}

// ---------- AI 面试陪练 ----------

export interface InterviewCategory {
  name: string;
  total: number;
  done: number;
}

export interface InterviewQuestion {
  id: number;
  category: string;
  question: string;
  source: string;
}

export interface InterviewAnswerResp {
  scores: Record<string, number>;
  total: number;
  summary: string;
  review: string;
  session_id?: number;
}

export interface InterviewSessionDetail {
  id: number;
  question_id: number;
  category: string;
  question_text: string;
  source?: string;
  answer_text: string;
  duration_sec: number;
  scores: Record<string, number>;
  total: number;
  review: string;
  points?: string[];
  created_at?: number;
}

export interface InterviewHistoryItem {
  id: number;
  category: string;
  question_text: string;
  total: number;
  created_at: number;
}

export function interviewCategories(): Promise<{ categories: InterviewCategory[]; total: number }> {
  return request('/api/interview/categories?uid=' + encodeURIComponent(anonUid()));
}

export function interviewDraw(
  category?: string,
  excludeId?: number
): Promise<{ question: InterviewQuestion }> {
  let qs = 'uid=' + encodeURIComponent(anonUid());
  if (category) qs += '&category=' + encodeURIComponent(category);
  if (excludeId) qs += '&exclude_id=' + excludeId;
  return request('/api/interview/question?' + qs);
}

export function interviewAnswer(
  questionId: number,
  answer: string,
  durationSec: number
): Promise<InterviewAnswerResp> {
  return request('/api/interview/answer', {
    method: 'POST',
    data: { uid: anonUid(), question_id: questionId, answer, duration_sec: durationSec || 0 },
  });
}

export function interviewHistory(limit = 50): Promise<{ items: InterviewHistoryItem[] }> {
  return request('/api/interview/history?uid=' + encodeURIComponent(anonUid()) + '&limit=' + limit);
}

export function interviewSession(id: number): Promise<{ session: InterviewSessionDetail }> {
  return request('/api/interview/sessions/' + id + '?uid=' + encodeURIComponent(anonUid()));
}

// ---------- 答题 PK ----------

export interface PkQuestion {
  id: number;
  module: string;
  submodule?: string | null;
  question: string;
  options: Record<string, string>;
}

export interface PkPlayer {
  name: string;
  done: boolean;
  score: number;
  correct: number;
  time_ms: number | null;
}

export interface PkMatch {
  code: string;
  module: string | null;
  status: string;
  winner: string | null;
  n_questions: number;
  creator: PkPlayer;
  opponent: PkPlayer | null;
  my_side: string | null;
}

export interface PkMineItem extends PkMatch {
  created_at?: number;
}

export function pkNickname(): string {
  const u = getAuthUser();
  if (u && u.nickname) return u.nickname;
  if (u && u.phone) return '考友' + String(u.phone).slice(-4);
  let n = wx.getStorageSync<string>('pkNickname');
  if (!n) {
    n = '考友' + Math.random().toString(36).slice(2, 6).toUpperCase();
    wx.setStorageSync('pkNickname', n);
  }
  return n;
}

export function pkCreate(module: string | null): Promise<{ code: string; questions: PkQuestion[] }> {
  return request('/api/pk/create', {
    method: 'POST',
    data: { uid: anonUid(), nickname: pkNickname(), module: module || null },
  });
}

export function pkJoin(code: string): Promise<{ code: string; module: string | null; questions: PkQuestion[] }> {
  return request('/api/pk/join', {
    method: 'POST',
    data: { uid: anonUid(), nickname: pkNickname(), code },
  });
}

export function pkRandomMatch(
  module: string | null
): Promise<{ matched: boolean; code: string; questions: PkQuestion[] }> {
  return request('/api/pk/random_match', {
    method: 'POST',
    data: { uid: anonUid(), nickname: pkNickname(), module: module || null },
  });
}

export function pkMatch(code: string): Promise<{ match: PkMatch }> {
  return request(
    '/api/pk/match/' + encodeURIComponent(code) + '?uid=' + encodeURIComponent(anonUid())
  );
}

export function pkSubmit(
  code: string,
  items: Array<{ question_id: number; answer: string; ms: number }>
): Promise<{ match: PkMatch }> {
  return request('/api/pk/submit', { method: 'POST', data: { uid: anonUid(), code, items } });
}

export function pkMine(): Promise<{ items: PkMineItem[]; wins: number }> {
  return request('/api/pk/mine?uid=' + encodeURIComponent(anonUid()));
}

export interface PkLeaderboard {
  items: Array<{ rank: number; name: string; wins: number }>;
  my_rank: number | null;
  my_wins: number;
}

export function pkLeaderboard(): Promise<PkLeaderboard> {
  return request('/api/pk/leaderboard?uid=' + encodeURIComponent(anonUid()));
}

// ---------- 时政每日一练 ----------

export interface ShizhengQuestion {
  id?: number;
  question: string;
  options: Record<string, string>;
  answer: string;
  explanation?: string;
  source_note?: string;
}

export function fetchShizhengDaily(): Promise<{ date: string; items: ShizhengQuestion[]; total: number }> {
  return request('/api/shizheng/daily');
}

// ---------- 申论 ----------

export interface ShenlunQuestion {
  id: number;
  qtype: string;
  question: string;
  paper?: string | null;
  exam_year?: number | null;
  exam_region?: string | null;
}

export interface ShenlunDetail extends ShenlunQuestion {
  material: string;
  reference: string;
  notes?: string | null;
}

export interface ShenlunHistoryItem {
  id: number;
  qid: number;
  qtype?: string;
  question?: string;
  answer: string;
  result?: string;
  created_at: number;
}

export interface ShenlunMaterial {
  id: number;
  type: string;
  topic: string;
  content: string;
  source?: string | null;
}

export function fetchShenlunQuestions(p: {
  qtype?: string;
  year?: number;
  region?: string;
  offset?: number;
}): Promise<{ items: ShenlunQuestion[]; total: number }> {
  let q = '/api/shenlun/questions?limit=20&offset=' + (p.offset || 0);
  if (p.qtype) q += '&qtype=' + encodeURIComponent(p.qtype);
  if (p.year) q += '&year=' + p.year;
  if (p.region) q += '&region=' + encodeURIComponent(p.region);
  return request(q);
}

export function fetchShenlunFilters(): Promise<{ years: number[]; regions: string[] }> {
  return request('/api/shenlun/filters');
}

export function fetchShenlunDetail(id: number): Promise<{ item: ShenlunDetail }> {
  return request('/api/shenlun/questions/' + id);
}

export function gradeShenlun(qid: number, answer: string): Promise<{ result: string }> {
  return request('/api/shenlun/grade', {
    method: 'POST',
    data: { qid, answer, uid: anonUid() },
  });
}

export function fetchShenlunHistory(qid?: number, limit = 50): Promise<{ items: ShenlunHistoryItem[] }> {
  let q = '/api/shenlun/history?limit=' + limit + '&uid=' + encodeURIComponent(anonUid());
  if (qid) q = '/api/shenlun/history?qid=' + qid + '&uid=' + encodeURIComponent(anonUid());
  return request(q);
}

export function fetchShenlunMaterials(
  type?: string,
  offset = 0
): Promise<{ items: ShenlunMaterial[] }> {
  let q = '/api/shenlun/materials?limit=20&offset=' + offset;
  if (type) q += '&type=' + encodeURIComponent(type);
  return request(q);
}

export function fetchShenlunMatFavs(): Promise<{ ids: number[] }> {
  return request('/api/shenlun/mat_favs?uid=' + encodeURIComponent(anonUid()));
}

export function setShenlunMatFav(mid: number, on: boolean): Promise<void> {
  return request('/api/shenlun/mat_favs', {
    method: 'POST',
    data: { uid: anonUid(), mid, on },
  });
}

// ---------- 每题讨论区 ----------

export interface CommentItem {
  id: number;
  nickname: string;
  content: string;
  likes: number;
  liked: boolean;
  mine: boolean;
  parent_id?: number | null;
  created_at: number;
  replies: CommentItem[];
}

export interface QuestionBrief {
  id: number;
  module: string;
  question: string;
  answer: string;
  is_real?: boolean;
  exam_year?: number | null;
  exam_region?: string | null;
  attempt_count?: number;
  correct_ratio?: number | null;
}

export function fetchComments(
  questionId: number,
  sort: string
): Promise<{ items: CommentItem[]; total: number }> {
  return request(
    '/api/comments?question_id=' +
      questionId +
      '&sort=' +
      (sort || 'hot') +
      '&uid=' +
      encodeURIComponent(anonUid())
  );
}

export function postComment(
  questionId: number,
  content: string,
  parentId?: number | null
): Promise<{ item: CommentItem }> {
  return request('/api/comments', {
    method: 'POST',
    data: { question_id: questionId, content, parent_id: parentId || null },
  });
}

export function likeComment(cid: number): Promise<{ liked: boolean; likes: number }> {
  return request('/api/comments/' + cid + '/like', { method: 'POST' });
}

export function deleteOwnComment(cid: number): Promise<void> {
  return request('/api/comments/' + cid, { method: 'DELETE' });
}

export function fetchCommentCount(questionId: number): Promise<{ total: number }> {
  return request('/api/comments/count?question_id=' + questionId);
}

export function fetchQuestionBrief(id: number): Promise<{ item: QuestionBrief }> {
  return request('/api/question/' + id);
}

// ---------- 题目纠错 ----------

export function postQuestionReport(
  questionId: number,
  type: string,
  detail: string
): Promise<void> {
  return request('/api/question_report', {
    method: 'POST',
    data: { question_id: questionId, uid: anonUid(), type, detail: detail.slice(0, 500) },
  });
}
