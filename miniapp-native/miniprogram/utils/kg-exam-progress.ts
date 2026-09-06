// 模考进度快照（本机 examProgress）+ 服务端 /api/exam/resume 采纳 + 交卷失败分流
// 对齐 frontend-uni/src/exam-resume.js、exam-progress-sync.js、exam-policy.js
import type { ExamPaperInfo, Question } from '../api/types';
import type { ExamResumeResp } from '../api/exam-types';

export const PROG_KEY = 'examProgress';
export const CLEARED_KEY = 'erClearedAt';

export interface EQuestion extends Question {
  _picked: string;
  _marked: boolean;
  _secs: number;
  _excl: string[];
}

export interface ExamProgressSnap {
  attemptId: number;
  paperId: number;
  mini: boolean;
  eventId?: number | null;
  paper: ExamPaperInfo;
  items: EQuestion[];
  idx: number;
  endAt: number;
}

export interface ResumeInfo {
  attemptId: number;
  paperId: number;
  mini: boolean;
  eventId: number | null;
  title: string;
  answered: number;
  total: number;
  leftSecs: number;
}

export function toEQ(q: Question): EQuestion {
  return { ...q, _picked: '', _marked: false, _secs: 0, _excl: [] };
}

export function loadSnap(): ExamProgressSnap | null {
  const s = wx.getStorageSync(PROG_KEY) as ExamProgressSnap | '';
  return s && typeof s === 'object' && s.attemptId ? s : null;
}

export function saveSnap(s: ExamProgressSnap): void {
  wx.setStorageSync(PROG_KEY, s);
}

export function clearSnap(): void {
  wx.removeStorageSync(PROG_KEY);
}

/** 快照 → 续考横幅数据；无效/过期返回 null */
export function parseExamProgress(saved: ExamProgressSnap | null, now: number): ResumeInfo | null {
  if (!saved || !saved.attemptId) return null;
  const items = Array.isArray(saved.items) ? saved.items : [];
  if (!items.length) return null;
  const endAt = Number(saved.endAt);
  if (!Number.isFinite(endAt) || endAt <= now) return null;
  const mini = !!saved.mini;
  const title = (saved.paper && saved.paper.title) || (mini ? '迷你模考' : '真题模考');
  return {
    attemptId: Number(saved.attemptId) || 0,
    paperId: mini ? 0 : Number(saved.paperId) || 0,
    mini,
    eventId: saved.eventId || null,
    title,
    answered: items.filter((q) => q && q._picked).length,
    total: items.length,
    leftSecs: Math.floor((endAt - now) / 1000),
  };
}

/** 服务端进度 → 本机快照；本机快照仍有效时一律本机优先（返回 null） */
export function adoptServerExamProgress(
  local: ExamProgressSnap | null,
  server: ExamResumeResp | null,
  now: number
): ExamProgressSnap | null {
  if (parseExamProgress(local, now)) return null;
  if (!server || !server.attempt_id || !server.paper || !server.paper.id) return null;
  if (!Array.isArray(server.items) || !server.items.length) return null;
  const endAt = Number(server.end_at_ms);
  if (!Number.isFinite(endAt) || endAt <= now) return null;
  const picks: Record<string, string> = server.picks && typeof server.picks === 'object' ? server.picks : {};
  const marked = new Set((Array.isArray(server.marks) ? server.marks : []).map(Number).filter((m) => Number.isFinite(m)));
  const rawSecs: Record<string, number> =
    server.secs && typeof server.secs === 'object' && !Array.isArray(server.secs) ? server.secs : {};
  const rawExcl: Record<string, string[]> =
    server.excl && typeof server.excl === 'object' && !Array.isArray(server.excl) ? server.excl : {};
  const items: EQuestion[] = server.items.map((q) => {
    const id = String(q.id);
    const secs = Number(rawSecs[id]);
    const ex = Array.isArray(rawExcl[id]) ? rawExcl[id].filter((x) => ['A', 'B', 'C', 'D'].includes(x)) : [];
    return {
      ...q,
      _picked: typeof picks[id] === 'string' ? picks[id] : '',
      _marked: marked.has(Number(q.id)),
      _secs: Number.isFinite(secs) && secs > 0 ? Math.floor(secs) : 0,
      _excl: ex,
    };
  });
  const idx = Number.isInteger(server.idx) && server.idx > 0 ? Math.min(server.idx, items.length - 1) : 0;
  return {
    attemptId: server.attempt_id,
    paperId: server.paper.id,
    mini: !!server.mini,
    paper: server.paper,
    items,
    idx,
    endAt,
  };
}

/** 卷库/首页共用：本机快照优先，否则拉服务端 resume 采纳（30s 内刚放弃过则跳过） */
export async function resolveResume(
  fetchServer: () => Promise<ExamResumeResp | null>
): Promise<ResumeInfo | null> {
  const now = Date.now();
  const local = loadSnap();
  const r = parseExamProgress(local, now);
  if (r) return r;
  if (local) clearSnap();
  const clearedAt = Number(wx.getStorageSync(CLEARED_KEY)) || 0;
  if (clearedAt && now - clearedAt < 30 * 1000) return null;
  try {
    const d = await fetchServer();
    const snap = adoptServerExamProgress(null, d, now);
    if (!snap) return null;
    saveSnap(snap);
    return parseExamProgress(snap, now);
  } catch (e) {
    return null;
  }
}

/** 放弃未交卷进度：记 erClearedAt（30s 内不再拉服务端）+ 清本机快照 + 通知服务端 drop */
export function dropResume(r: ResumeInfo | null, serverDrop: (attemptId: number) => Promise<unknown>): void {
  wx.setStorageSync(CLEARED_KEY, Date.now());
  if (r && r.attemptId) serverDrop(r.attemptId).catch(() => undefined);
  clearSnap();
}

/** 续考横幅：进入对应模考页 */
export function resumeUrl(r: ResumeInfo): string {
  return r.mini ? '/pkgExam/exam/exam?mini=1' : '/pkgExam/exam/exam?paper_id=' + r.paperId;
}

// ---------- 交卷失败分流 ----------

export const SUBMIT_MAX_AUTO_RETRIES = 5;

const isNetMsg = (msg: string): boolean => /timeout|超时|网络错误|request:fail/i.test(msg);
export const submitRetryable = (msg: string): boolean =>
  isNetMsg(msg) || /^HTTP (5\d\d|429)$/.test(msg) || /请求过于频繁/.test(msg);

export type SubmitFailPlan = { action: 'terminal' } | { action: 'manual' } | { action: 'retry'; delayMs: number };

/**
 * terminal：确定性错误（如 404）会话已失效；manual：时间未到或重试达上限；
 * retry：时间到 + 可重试错误，指数退避 5s→10s→20s→40s→60s 封顶
 */
export function submitFailPlan(p: { message: string; timeUp: boolean; tries: number }): SubmitFailPlan {
  if (!submitRetryable(p.message)) return { action: 'terminal' };
  if (!p.timeUp || p.tries >= SUBMIT_MAX_AUTO_RETRIES) return { action: 'manual' };
  return { action: 'retry', delayMs: Math.min(5000 * 2 ** p.tries, 60000) };
}

/** 成绩报告「本卷错题重练」交接的题集（与 H5 redoSet 同键，读后即清） */
export const REDO_SET_KEY = 'redoSet';

export function takeRedoSet(): { items: Question[] } {
  const v = wx.getStorageSync(REDO_SET_KEY);
  wx.removeStorageSync(REDO_SET_KEY);
  return { items: Array.isArray(v) ? (v as Question[]) : [] };
}
