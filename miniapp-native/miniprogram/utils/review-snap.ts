// 复习会话快照（对应 H5 review-snap.js，fail-closed 纯函数）：中断后可恢复本轮复习；本地 storage + /api/review/cur 双写
import type { ReviewSnap } from '../api/learn';

const TTL_S = 2 * 3600;
const MAX_BYTES = 200 * 1024;
const MAX_ITEMS = 80;

export const REVIEW_SNAP_KEY = 'reviewSnap';

export interface ReviewState {
  rItems: Array<Record<string, unknown> & { question_text: string }>;
  rIdx: number;
  picked: string;
  answered: boolean;
  wasCorrect: boolean;
  nextDays: number;
}

export interface ReviewResume {
  rIdx: number;
  items: ReviewSnap['items'];
  picked: string | null;
  answered: boolean;
  wasCorrect: boolean;
  nextDays: number;
}

function validItems(items: unknown): items is ReviewSnap['items'] {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.length <= MAX_ITEMS &&
    items.every(
      (x) => x && typeof x === 'object' && typeof (x as { question_text?: unknown }).question_text === 'string' && (x as { question_text: string }).question_text
    )
  );
}

export function buildReviewSnap(state: ReviewState, uid: string, now: number): ReviewSnap | null {
  if (!uid) return null;
  const items = (state.rItems || []).map((x) => {
    const { open, html, ...rest } = x as Record<string, unknown> & { question_text: string; open?: unknown; html?: unknown };
    void open;
    void html;
    return rest;
  });
  if (!validItems(items)) return null;
  const rIdx = Number(state.rIdx);
  if (!Number.isInteger(rIdx) || rIdx < 0 || rIdx >= items.length) return null;
  const snap: ReviewSnap = {
    v: 1,
    uid: String(uid),
    ts: Math.floor(Number(now) || 0),
    rIdx,
    items,
    picked: typeof state.picked === 'string' ? state.picked : null,
    answered: state.answered === true,
    wasCorrect: state.wasCorrect === true,
    nextDays: Number(state.nextDays) || 0,
  };
  try {
    if (JSON.stringify(snap).length > MAX_BYTES) return null;
  } catch (e) {
    return null;
  }
  return snap;
}

export function parseReviewSnap(raw: unknown, uid: string, now: number): ReviewResume | null {
  let s = raw;
  if (typeof s === 'string') {
    try {
      s = JSON.parse(s);
    } catch (e) {
      return null;
    }
  }
  if (!s || typeof s !== 'object') return null;
  const o = s as Partial<ReviewSnap>;
  if (o.v !== 1 || !uid || o.uid !== String(uid)) return null;
  const ts = Number(o.ts);
  const t = Math.floor(Number(now) || 0);
  if (!Number.isInteger(ts) || ts <= 0 || t - ts > TTL_S || ts > t + 60) return null;
  if (!validItems(o.items)) return null;
  const rIdx = Number(o.rIdx);
  if (!Number.isInteger(rIdx) || rIdx < 0 || rIdx >= o.items.length) return null;
  return {
    rIdx,
    items: o.items,
    picked: typeof o.picked === 'string' ? o.picked : null,
    answered: o.answered === true,
    wasCorrect: o.wasCorrect === true,
    nextDays: Number(o.nextDays) || 0,
  };
}

// 单题作答用时（秒，与 H5 reviewElapsedSecs 同口径）：无起点/异常时钟回 undefined，上限 1h
export const REVIEW_SECS_MAX = 3600;
export function reviewElapsedSecs(startMs: number | undefined, nowMs: number): number | undefined {
  if (!startMs || !(startMs > 0) || !(nowMs >= startMs)) return undefined;
  return Math.min(REVIEW_SECS_MAX, Math.max(1, Math.round((nowMs - startMs) / 1000)));
}
