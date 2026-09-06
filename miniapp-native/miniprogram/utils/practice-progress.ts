// 刷题进度（续做）纯函数：与 frontend-uni/src/practice-progress.js 同口径
// - collectPracticeProgress：本地题组 -> /api/practice/progress 载荷
// - adoptPracticeResume：/api/practice/resume 应答 -> 可直接接管的题组
// - parsePendingPractice / parseRemotePractice：首页「继续上次练习」卡片摘要
import type { Question } from '../api/types';
import type { PracticeProgressPayload, PracticeResumeResp } from '../api/learn';

export interface ProgressQuestion extends Question {
  _picked?: string;
  _excl?: string[];
  _logged?: boolean;
  _secs?: number;
}

export interface PendingSession {
  t: number;
  items: ProgressQuestion[];
  idx: number;
  right: number;
  streak: number;
  bestStreak: number;
  lastModule: string;
  lastSubmodule: string;
  source: string;
  ptitle: string;
}

export const PENDING_KEY = 'pendingSession';
export const PP_CLEARED_KEY = 'ppClearedAt';
const LETTERS = ['A', 'B', 'C', 'D'];
const DAY_MS = 24 * 3600 * 1000;

function clamp(v: unknown, hi: number): number {
  return Number.isInteger(v) && (v as number) >= 0 ? Math.min(v as number, hi) : 0;
}

export function collectPracticeProgress(
  items: ProgressQuestion[],
  idx: number,
  right: number,
  streak: number,
  bestStreak: number,
  module: string,
  submodule: string,
  source: string,
  ptitle: string
): PracticeProgressPayload | null {
  if (!Array.isArray(items) || !items.length || items.length > 100) return null;
  const qids: number[] = [];
  const picks: Record<string, string> = {};
  const excl: Record<string, string[]> = {};
  for (const q of items) {
    if (!q || !Number.isInteger(q.id) || (q.id as number) <= 0) return null;
    const id = q.id as number;
    qids.push(id);
    if (q._picked && LETTERS.includes(q._picked)) picks[id] = q._picked;
    if (Array.isArray(q._excl)) {
      const letters = q._excl.filter((x) => LETTERS.includes(x));
      if (letters.length) excl[id] = letters.slice(0, 4);
    }
  }
  const n = qids.length;
  return {
    qids,
    picks,
    excl,
    idx: clamp(idx, n - 1),
    right: clamp(right, n),
    streak: clamp(streak, n),
    best_streak: clamp(bestStreak, 10000),
    module: (module || '').slice(0, 64),
    submodule: (submodule || '').slice(0, 64),
    source: (source || '').slice(0, 64),
    ptitle: (ptitle || '').slice(0, 80),
  };
}

export interface ResumeSnap {
  items: ProgressQuestion[];
  idx: number;
  right: number;
  streak: number;
  bestStreak: number;
  module: string;
  submodule: string;
  source: string;
  ptitle: string;
}

export function adoptPracticeResume(d: PracticeResumeResp | null): ResumeSnap | null {
  if (!d || !Array.isArray(d.items) || !d.items.length) return null;
  const picks = d.picks && typeof d.picks === 'object' ? d.picks : {};
  const excl = d.excl && typeof d.excl === 'object' ? d.excl : {};
  const items: ProgressQuestion[] = d.items.map((q) => {
    const p = picks[String(q.id)];
    const e = excl[String(q.id)];
    const picked = p && LETTERS.includes(p) ? p : '';
    const letters = Array.isArray(e) ? e.filter((x) => LETTERS.includes(x)).slice(0, 4) : [];
    return { ...q, _picked: picked, _excl: letters, _logged: !!picked, _secs: 0 };
  });
  return {
    items,
    idx: clamp(d.idx, items.length - 1),
    right: clamp(d.right, items.length),
    streak: clamp(d.streak, items.length),
    bestStreak: clamp(d.best_streak, 10000),
    module: typeof d.module === 'string' ? d.module : '',
    submodule: typeof d.submodule === 'string' ? d.submodule : '',
    source: typeof d.source === 'string' ? d.source : '',
    ptitle: typeof d.ptitle === 'string' ? d.ptitle : '',
  };
}

export interface ResumeBrief {
  done: number;
  total: number;
  module: string;
  ptitle: string;
}

export function parsePendingPractice(saved: PendingSession | null | '', now: number): ResumeBrief | null {
  if (!saved || !Array.isArray(saved.items) || !saved.items.length) return null;
  const t = Number(saved.t);
  if (!Number.isFinite(t) || now - t > DAY_MS) return null;
  const done = saved.items.filter((q) => q && q._picked).length;
  if (done >= saved.items.length) return null;
  return {
    done,
    total: saved.items.length,
    module: typeof saved.lastModule === 'string' ? saved.lastModule : '',
    ptitle: typeof saved.ptitle === 'string' ? saved.ptitle : '',
  };
}

export function parseRemotePractice(d: PracticeResumeResp | null): ResumeBrief | null {
  if (!d || !Array.isArray(d.items) || !d.items.length) return null;
  const picks = d.picks && typeof d.picks === 'object' ? d.picks : {};
  const done = d.items.filter((q) => q && picks[String(q.id)] != null).length;
  if (done >= d.items.length) return null;
  return {
    done,
    total: d.items.length,
    module: typeof d.module === 'string' ? d.module : '',
    ptitle: typeof d.ptitle === 'string' ? d.ptitle : '',
  };
}

export function readPendingSession(): PendingSession | null {
  const s = wx.getStorageSync<PendingSession | ''>(PENDING_KEY);
  if (!s || !Array.isArray(s.items) || !s.items.length) return null;
  if (Date.now() - Number(s.t) > DAY_MS) return null;
  return s;
}
