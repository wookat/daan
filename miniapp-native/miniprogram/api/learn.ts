// Learn 组（刷题核心链路）接口封装：与 frontend-uni/src 同接口、同参数口径。
// 新增文件，不改 api/index.ts；uid 一律走 utils/auth.anonUid()。
import { anonUid } from '../utils/auth';
import { BASE_URL, request } from '../utils/request';
import { getAccessCode, getToken } from '../utils/auth';
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

// AI 讲解评分（H5 ask.vue：key=explain_key）
export function rateExplainKey(key: string, up: boolean): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/rate', { method: 'POST', data: { key, up } });
}

export function patchMistakeReason(mid: number, reason: string): Promise<void> {
  return request<void>('/api/mistakes/' + mid, { method: 'PATCH', data: { uid: anonUid(), error_reason: reason } });
}

// ---------- AI 讲解 / 追问 / 相似题 ----------

export interface ExplainMeta {
  module: string | null;
  module_name: string | null;
  question_type: string | null;
  question_text: string;
  user_answer: string | null;
  explain_key: string;
  cached: boolean;
}
export interface ExplainResp extends ExplainMeta {
  explanation: string;
}

function formHeader(): Record<string, string> {
  const t = getToken();
  return {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Access-Code': getAccessCode(),
    ...(t ? { Authorization: 'Bearer ' + t } : {}),
  };
}

// 非流式版本：与 H5 uploadExplain 同接口（/api/explain，form 编码）
export function explainText(text: string, userAnswer?: string | null): Promise<ExplainResp> {
  const data: Record<string, string> = { text };
  if (userAnswer) data.user_answer = userAnswer;
  return request<ExplainResp>('/api/explain', {
    method: 'POST',
    data,
    header: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

interface SseEvent {
  type: string;
  data: Record<string, unknown>;
}
// 与 api-policy.parseSseEvents 同口径：按空行切事件，尾部残片留到下一 chunk
export function parseSseEvents(buf: string): { rest: string; events: SseEvent[] } {
  const parts = buf.split('\n\n');
  const rest = parts.pop() || '';
  const events: SseEvent[] = [];
  for (const ev of parts) {
    const typeM = ev.match(/^event: (\w+)/m);
    const dataM = ev.match(/^data: (.*)$/m);
    if (!dataM) continue;
    events.push({ type: typeM ? typeM[1] : 'message', data: JSON.parse(dataM[1]) as Record<string, unknown> });
  }
  return { rest, events };
}

// 分块 UTF-8 解码：chunk 边界可能切断多字节字符，把残缺尾字节留到下一块
export function makeUtf8Decoder(): (buf: ArrayBuffer) => string {
  let pending: number[] = [];
  return (arrayBuffer: ArrayBuffer): string => {
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
        s += String.fromCodePoint(((b & 0x07) << 18) | ((all[i + 1] & 0x3f) << 12) | ((all[i + 2] & 0x3f) << 6) | (all[i + 3] & 0x3f));
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

export interface StreamExplainOpts {
  text: string;
  userAnswer?: string | null;
  onMeta?: (m: ExplainMeta) => void;
  onDelta?: (full: string) => void;
}
// 流式讲解：wx.request enableChunked 读 onChunkReceived；基础库不支持分块时降级 /api/explain 非流式
export function streamExplain(o: StreamExplainOpts): Promise<ExplainResp> {
  const formBody: Record<string, string> = { text: o.text };
  if (o.userAnswer) formBody.user_answer = o.userAnswer;
  const fallback = () =>
    explainText(o.text, o.userAnswer).then((d) => {
      if (o.onMeta) o.onMeta(d);
      if (o.onDelta) o.onDelta(d.explanation || '');
      return d;
    });
  return new Promise<ExplainResp>((resolve, reject) => {
    const state = { buf: '', full: '', meta: null as ExplainMeta | null, gotChunk: false };
    const finish = () => {
      if (!state.meta) reject(new Error('生成失败：无响应'));
      else resolve({ ...state.meta, explanation: state.full });
    };
    const task = wx.request({
      url: BASE_URL + '/api/explain/stream',
      method: 'POST',
      header: formHeader(),
      data: formBody,
      enableChunked: true,
      timeout: 180000,
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error('HTTP ' + res.statusCode));
          return;
        }
        if (!state.gotChunk) {
          // 无分块能力：整段 SSE 一次到达 / 或为空，解析剩余文本后仍无 meta 则降级
          const raw = typeof res.data === 'string' ? res.data : '';
          if (raw) feed(raw);
          if (!state.meta) {
            fallback().then(resolve, reject);
            return;
          }
        }
        finish();
      },
      fail: (err) => reject(new Error(err.errMsg || '网络错误')),
    });
    const decode = makeUtf8Decoder();
    const feed = (chunkText: string) => {
      const { rest, events } = parseSseEvents(state.buf + chunkText);
      state.buf = rest;
      for (const ev of events) {
        if (ev.type === 'meta') {
          state.meta = ev.data as unknown as ExplainMeta;
          if (o.onMeta) o.onMeta(state.meta);
        } else if (ev.type === 'error') {
          throw new Error(String(ev.data.message || '生成失败'));
        } else if (ev.type === 'message') {
          state.full += String(ev.data.d || '');
          if (o.onDelta) o.onDelta(state.full);
        }
      }
    };
    if (task && typeof task.onChunkReceived === 'function') {
      task.onChunkReceived((r) => {
        state.gotChunk = true;
        try {
          feed(decode(r.data));
        } catch (e) {
          reject(e as Error);
        }
      });
    }
  });
}

export interface FollowupMsg {
  role: 'user' | 'assistant';
  content: string;
}
export function followup(
  questionText: string,
  explanation: string,
  history: FollowupMsg[],
  query: string
): Promise<{ answer: string }> {
  return request<{ answer: string }>('/api/followup', {
    method: 'POST',
    data: { question_text: questionText, explanation, history, query },
  });
}

export function similarQuestion(questionText: string, questionType: string | null): Promise<{ content: string }> {
  return request<{ content: string }>('/api/similar', {
    method: 'POST',
    data: { question_text: questionText, question_type: questionType },
  });
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
export function redoMistakesFiltered(f: RedoFilter): Promise<{ items: Question[] }> {
  let q = '/api/mistakes/redo?limit=' + (f.limit || 10) + '&uid=' + encodeURIComponent(anonUid());
  if (f.qtype) q += '&qtype=' + encodeURIComponent(f.qtype);
  if (f.module) q += '&module=' + encodeURIComponent(f.module);
  if (f.noqt) q += '&noqt=1';
  if (f.rz) q += '&rz=' + encodeURIComponent(f.rz);
  if (f.src) q += '&src=' + f.src;
  if (f.t3) q += '&t3=' + encodeURIComponent(f.t3);
  return request<{ items: Question[] }>(q);
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
