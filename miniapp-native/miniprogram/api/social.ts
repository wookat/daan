// Social + AI 接口封装（对齐 frontend-uni/src/api.js 同名函数；不新增后端接口）
// AI 问答 / 追问 / 同款题 / 评分 / 会话同步 / 讨论区 / 收藏 / PK / 面试陪练

import { anonUid, getAccessCode, getToken, pkNickname } from '../utils/auth';
import { BASE_URL, request } from '../utils/request';
import type { SseHandlers } from '../utils/sse';
import { streamPost, StreamUnsupportedError } from '../utils/sse';
import type { AskItem, AskSession } from '../utils/ask-sessions';
import type { FavItem } from './types';

function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: 'Bearer ' + t } : {};
}

function uidQ(): string {
  return 'uid=' + encodeURIComponent(anonUid());
}

// ---------- AI 讲解 ----------

export interface ExplainMeta {
  module?: string | null;
  module_name?: string | null;
  question_type?: string | null;
  question_text?: string | null;
  explain_key?: string | null;
  cached?: boolean;
  /** 服务端按 question_id 直通题库确认的题号；缓存命中或未命中题库时为空 */
  qid?: number | null;
}

export interface ExplainResp extends ExplainMeta {
  explanation: string;
}

export interface ExplainArgs extends SseHandlers<ExplainMeta> {
  filePath?: string | null;
  text?: string | null;
  userAnswer?: string | null;
  /** 题库题号（刷题/搜索/历史/收藏深链带入）：服务端题干命中即跳过识题 LLM 并以题库答案为准；图片题不带 */
  questionId?: number | null;
}

// 非流式 /api/explain：图片走 wx.uploadFile，文字走 x-www-form-urlencoded
export function uploadExplain({ filePath, text, userAnswer }: ExplainArgs): Promise<ExplainResp> {
  const formData: Record<string, string> = {};
  if (text) formData.text = text;
  if (userAnswer) formData.user_answer = userAnswer;
  if (!filePath) {
    return request<ExplainResp>('/api/explain', {
      method: 'POST',
      header: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: formData,
    });
  }
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: BASE_URL + '/api/explain',
      filePath,
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

// 流式优先：文字题走 /api/explain/stream（enableChunked）；图片题或分块不可用时降级 uploadExplain
export async function streamExplain(args: ExplainArgs): Promise<ExplainResp> {
  const { filePath, text, userAnswer, questionId, onMeta, onDelta } = args;
  const fallback = async () => {
    const d = await uploadExplain({ filePath, text, userAnswer });
    if (onMeta) onMeta(d);
    if (onDelta) onDelta(d.explanation || '');
    return d;
  };
  if (filePath || !text) return fallback();
  try {
    const st = await streamPost<ExplainMeta>({
      path: '/api/explain/stream',
      header: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Access-Code': getAccessCode(),
        ...authHeader(),
      },
      data: {
        text,
        ...(userAnswer ? { user_answer: userAnswer } : {}),
        ...(questionId && questionId > 0 ? { question_id: questionId } : {}),
      },
      onMeta,
      onDelta,
    });
    return { ...(st.meta as ExplainMeta), explanation: st.full };
  } catch (e) {
    // 分块不可用 / HTTP 非 2xx（含 502 AI 未配置）：走非流式拿到后端友好文案
    if (e instanceof StreamUnsupportedError) return fallback();
    throw e;
  }
}

export function followup(body: {
  question_text?: string;
  explanation?: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  query: string;
}): Promise<{ answer: string }> {
  return request<{ answer: string }>('/api/followup', { method: 'POST', data: { uid: anonUid(), ...body } });
}

export function similarQuestion(
  questionText: string,
  questionType?: string,
  difficulty?: string,
): Promise<{ content: string }> {
  return request<{ content: string }>('/api/similar', {
    method: 'POST',
    data: {
      uid: anonUid(),
      question_text: questionText,
      question_type: questionType || null,
      ...(difficulty ? { difficulty } : {}),
    },
  });
}

export function rateExplain(key: string, up: boolean): Promise<void> {
  return request<void>('/api/rate', { method: 'POST', data: { key, up } });
}

export function coachAdvice(stats: Record<string, unknown>): Promise<{ advice: string }> {
  return request<{ advice: string }>('/api/coach', { method: 'POST', data: { uid: anonUid(), stats } });
}

export function fetchAccessInfo(): Promise<{ required: boolean } | null> {
  return request<{ required: boolean }>('/api/access_info').catch(() => null);
}

// ---------- AI 问答会话同步 ----------

export function fetchAskSessions(): Promise<{ items: AskSession[] }> {
  return request<{ items: AskSession[] }>('/api/ask/sessions?' + uidQ());
}

export function saveAskSession(s: AskSession): Promise<void> {
  return request<void>('/api/ask/sessions', {
    method: 'POST',
    data: { uid: anonUid(), sid: s.id, ts: s.ts, title: s.title, n: s.n, items: s.items },
  });
}

export function deleteAskSession(sid: number): Promise<void> {
  return request<void>('/api/ask/sessions/' + sid + '?' + uidQ(), { method: 'DELETE' });
}

export function saveAskCur(sid: number, items: AskItem[]): Promise<void> {
  return request<void>('/api/ask/cur', {
    method: 'POST',
    data: items.length ? { uid: anonUid(), sid, ts: Date.now(), items } : { uid: anonUid(), items: [] },
  });
}

export function fetchAskCur(): Promise<unknown> {
  return request<unknown>('/api/ask/cur?' + uidQ());
}

// ---------- 讨论区 ----------

export interface CommentItem {
  id: number;
  question_id: number;
  nickname: string;
  content: string;
  parent_id: number | null;
  likes: number;
  liked: boolean;
  mine: boolean;
  deleted: boolean;
  created_at: number;
  replies?: CommentItem[];
}

export interface InboxItem {
  type: 'reply' | 'like';
  id: number;
  nickname?: string;
  content?: string;
  created_at: number;
  question_id: number;
  parent_content: string;
  unread: boolean;
}

export interface PlazaItem {
  question_id: number;
  cnt: number;
  last_at: number;
  stem: string;
  module: string;
  latest: { nickname: string; content: string };
}

export interface QuestionBrief {
  id: number;
  module?: string;
  question?: string;
  options?: Record<string, string>;
  answer?: string;
  is_real?: boolean;
  exam_year?: number | string | null;
  exam_region?: string | null;
  attempt_count?: number;
  correct_ratio?: number | null;
}

export function fetchQuestion(qid: number): Promise<{ item: QuestionBrief }> {
  return request<{ item: QuestionBrief }>('/api/question/' + qid);
}

export function fetchComments(questionId: number, sort: 'hot' | 'new'): Promise<{ items: CommentItem[]; total: number }> {
  return request<{ items: CommentItem[]; total: number }>(
    `/api/comments?question_id=${questionId}&sort=${sort || 'hot'}&${uidQ()}`
  );
}

export function postComment(questionId: number, content: string, parentId?: number | null): Promise<{ item: CommentItem }> {
  return request<{ item: CommentItem }>('/api/comments', {
    method: 'POST',
    data: { question_id: questionId, content, parent_id: parentId || null },
  });
}

export function likeComment(cid: number): Promise<{ liked: boolean; likes: number }> {
  return request<{ liked: boolean; likes: number }>(`/api/comments/${cid}/like`, { method: 'POST' });
}

export function deleteOwnComment(cid: number): Promise<void> {
  return request<void>(`/api/comments/${cid}`, { method: 'DELETE' });
}

export function reportComment(cid: number, reason: string): Promise<{ hidden?: boolean; already?: boolean }> {
  return request<{ hidden?: boolean; already?: boolean }>(`/api/comments/${cid}/report`, { method: 'POST', data: { reason } });
}

export function fetchCommentInbox(): Promise<{ items: InboxItem[]; unread: number }> {
  return request<{ items: InboxItem[]; unread: number }>('/api/comments/inbox');
}

export function fetchCommentsPlaza(): Promise<{ items: PlazaItem[] }> {
  return request<{ items: PlazaItem[] }>('/api/comments/plaza');
}

export function readCommentInbox(): Promise<void> {
  return request<void>('/api/comments/inbox/read', { method: 'POST' });
}

// ---------- 收藏（补齐 api/index.ts 未覆盖的部分） ----------

export function setFav(questionId: number, folderId?: number | null): Promise<void> {
  return request<void>('/api/favs', {
    method: 'POST',
    data: { uid: anonUid(), question_id: questionId, folder_id: folderId || null },
  });
}

export function fetchFavsBy(folderId?: number | null, mod?: string): Promise<{ items: FavItem[] }> {
  let p = '/api/favs?' + uidQ();
  if (folderId != null) p += '&folder_id=' + folderId;
  if (mod) p += '&module=' + encodeURIComponent(mod);
  return request<{ items: FavItem[] }>(p);
}

export function createFavFolderIcon(name: string, icon?: string): Promise<{ id: number }> {
  return request<{ id: number }>('/api/favs/folders', {
    method: 'POST',
    data: { uid: anonUid(), name, icon: icon || null },
  });
}

// ---------- 答题 PK ----------

export interface PkPlayer {
  name: string;
  score: number | null;
  correct: number | null;
  time_ms: number | null;
  done: boolean;
}

export interface PkMatch {
  code: string;
  module: string | null;
  n_questions: number;
  status: string;
  winner: string | null;
  creator: PkPlayer;
  opponent: PkPlayer | null;
  my_side: 'creator' | 'opponent' | null;
  created_at: number;
  finished_at: number | null;
  my_detail?: { question_id: number; answer: string; ms: number; correct?: boolean }[];
}

export interface PkQuestion {
  id: number;
  module?: string | null;
  submodule?: string | null;
  question: string;
  options: Record<string, string>;
  image?: string | null;
}

export interface PkJoinResp {
  code: string;
  module?: string | null;
  questions: PkQuestion[];
  matched?: boolean;
}

export interface PkLeaderboardResp {
  items: { uid: string; name: string; wins: number; rank?: number }[];
  week_start: string;
  my_rank: number | null;
  my_wins: number;
}

export function pkCreate(mod?: string | null): Promise<PkJoinResp> {
  return request<PkJoinResp>('/api/pk/create', {
    method: 'POST',
    data: { uid: anonUid(), nickname: pkNickname(), module: mod || null },
  });
}

export function pkJoin(code: string): Promise<PkJoinResp> {
  return request<PkJoinResp>('/api/pk/join', {
    method: 'POST',
    data: { uid: anonUid(), nickname: pkNickname(), code },
  });
}

export function pkRandomMatch(mod?: string | null): Promise<PkJoinResp> {
  return request<PkJoinResp>('/api/pk/random_match', {
    method: 'POST',
    data: { uid: anonUid(), nickname: pkNickname(), module: mod || null },
  });
}

export function pkMatch(code: string): Promise<{ match: PkMatch }> {
  return request<{ match: PkMatch }>(`/api/pk/match/${encodeURIComponent(code)}?${uidQ()}`);
}

export function pkSubmit(
  code: string,
  items: { question_id: number; answer: string; ms: number }[]
): Promise<{ match: PkMatch }> {
  return request<{ match: PkMatch }>('/api/pk/submit', {
    method: 'POST',
    data: { uid: anonUid(), code, items },
    timeout: 20000,
  });
}

export function pkMine(): Promise<{ items: PkMatch[]; wins: number }> {
  return request<{ items: PkMatch[]; wins: number }>('/api/pk/mine?' + uidQ());
}

export function pkLeaderboard(): Promise<PkLeaderboardResp> {
  return request<PkLeaderboardResp>('/api/pk/leaderboard?' + uidQ());
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
  source?: string;
}

export interface InterviewMeta {
  scores: Record<string, number>;
  total: number;
  summary: string;
  category: string;
  question_id: number;
  session_id?: number;
}

export interface InterviewAnswerResp extends InterviewMeta {
  session_id: number;
  review: string;
  points?: string[];
}

export interface InterviewHistoryItem {
  id: number;
  question_id: number;
  category: string;
  question_text: string;
  total: number;
  duration_sec: number;
  created_at: number;
}

export interface InterviewSession {
  id: number;
  question_id: number;
  category: string;
  question_text: string;
  answer_text: string | null;
  scores: Record<string, number>;
  total: number;
  summary?: string;
  review: string;
  duration_sec: number;
  created_at: number;
  points: string[];
  source: string;
}

export function interviewCategories(): Promise<{ categories: InterviewCategory[]; total: number }> {
  return request<{ categories: InterviewCategory[]; total: number }>('/api/interview/categories?' + uidQ());
}

export function interviewDraw(category?: string, excludeId?: number): Promise<{ question: InterviewQuestion }> {
  let p = '/api/interview/question?' + uidQ();
  if (category) p += '&category=' + encodeURIComponent(category);
  if (excludeId) p += '&exclude=' + excludeId;
  return request<{ question: InterviewQuestion }>(p);
}

export function interviewHistory(limit = 50): Promise<{ items: InterviewHistoryItem[]; total: number; best: number | null }> {
  return request<{ items: InterviewHistoryItem[]; total: number; best: number | null }>(
    `/api/interview/history?${uidQ()}&limit=${limit}`
  );
}

export function interviewSession(id: number): Promise<{ session: InterviewSession }> {
  return request<{ session: InterviewSession }>(`/api/interview/sessions/${id}?${uidQ()}`);
}

export interface InterviewStreamArgs extends SseHandlers<InterviewMeta> {
  questionId: number;
  answer: string;
  durationSec: number;
}

// 流式优先（/answer/stream），分块不可用时降级 /answer 一次性返回
export async function streamInterview(args: InterviewStreamArgs): Promise<InterviewAnswerResp> {
  const { questionId, answer, durationSec, onMeta, onDelta } = args;
  const body = { uid: anonUid(), question_id: questionId, answer, duration_sec: durationSec || 0 };
  const fallback = async () => {
    const d = await request<InterviewAnswerResp>('/api/interview/answer', { method: 'POST', data: body });
    if (onMeta) onMeta(d);
    if (onDelta) onDelta(d.review || '');
    return d;
  };
  try {
    const st = await streamPost<InterviewMeta>({
      path: '/api/interview/answer/stream',
      header: { 'Content-Type': 'application/json', 'X-Access-Code': getAccessCode(), ...authHeader() },
      data: body,
      onMeta,
      onDelta,
      errMsg: '点评生成失败',
    });
    const meta = st.meta as InterviewMeta;
    const sid = Number((st.done && st.done.session_id) || meta.session_id || 0);
    return { ...meta, session_id: sid, review: st.full };
  } catch (e) {
    if (e instanceof StreamUnsupportedError) return fallback();
    throw e;
  }
}
