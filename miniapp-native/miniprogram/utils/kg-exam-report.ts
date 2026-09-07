// 成绩报告派生口径：逐段移植 H5 exam-pace/exam-redo/exam-review/exam-marks/exam-goal/exam-mod-avg/exam-weak/exam-next/exam-board/exam-time/q-stat
import type { ExamPaperInfo, Question } from '../api/types';
import type { ExamAttempt, ExamPaper, ExamRankFull, ExamReportFullItem } from '../api/exam-types';

export const MOD_ORDER = ['changshi', 'yanyu', 'shuliang', 'panduan', 'ziliao'];
export const PACE_TAG: Record<string, string> = { over: '超时', fast: '偏快', ok: '合理', skip: '未作答' };

export type PerModule = Record<string, { n: number; answered?: number; correct: number; secs?: number }>;

export interface PaceRow {
  key: string;
  secs: number;
  refSecs: number;
  answered: number;
  n: number;
  status: 'skip' | 'ok' | 'over' | 'fast';
}

/** 模块配速：参考用时按各模块题量占比折算自本卷限时；整模块未作答标 skip 而非偏快 */
export function buildPaceRows(perModule: PerModule | null | undefined, durationMin: number, total: number): PaceRow[] {
  const pm = perModule || {};
  const dm = Number(durationMin) || 0;
  const tt = Number(total) || 0;
  if (dm <= 0 || tt <= 0) return [];
  const keys = Object.keys(pm).filter((k) => pm[k] && Number(pm[k].n) > 0);
  const sum = keys.reduce((a, k) => a + (Number(pm[k].secs) || 0), 0);
  if (sum <= 0) return [];
  return keys.map((k) => {
    const n = Number(pm[k].n);
    const secs = Math.max(0, Number(pm[k].secs) || 0);
    const answered = pm[k].answered == null ? n : Math.min(n, Math.max(0, Number(pm[k].answered) || 0));
    const perQ = (dm * 60) / tt;
    const refSecs = Math.round(perQ * n);
    if (answered === 0) return { key: k, secs, refSecs, answered, n, status: 'skip' };
    const judgeRef = Math.round(perQ * answered);
    let status: PaceRow['status'] = 'ok';
    if (secs > judgeRef * 1.2) status = 'over';
    else if (secs < judgeRef * 0.6) status = 'fast';
    return { key: k, secs, refSecs: judgeRef, answered, n, status };
  });
}

export function fmtMin(secs: number): string {
  const s = Math.max(0, Math.round(Number(secs) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (!m) return r + '秒';
  return r ? m + '分' + r + '秒' : m + '分';
}

/** 本卷错题重练集（刷题模式题面结构），最多 limit 题 */
export function buildExamRedoSet(items: ExamReportFullItem[] | undefined, limit = 10): Question[] {
  const out: Question[] = [];
  for (const it of items || []) {
    if (!it || !it.picked || it.correct) continue;
    if (!it.question_id || !it.question || !it.options || !it.answer) continue;
    out.push({
      id: it.question_id,
      question: it.question,
      options: it.options,
      answer: it.answer,
      explanation: it.explanation || '',
      hs_explanation: it.hs_explanation || '',
      module: it.module || '',
      submodule: it.submodule || null,
      image: it.image || null,
      image_credit: it.image_credit || null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export type NavMode = 'all' | 'wrong' | 'marked';

export function reviewFilter(items: ExamReportFullItem[], mode: NavMode): ExamReportFullItem[] {
  if (mode === 'wrong') return items.filter((it) => it && !it.correct);
  if (mode === 'marked') return items.filter((it) => it && it.marked);
  return items;
}

export function reviewStep(items: ExamReportFullItem[], curNo: number, dir: 1 | -1, mode: NavMode): ExamReportFullItem | null {
  const list = reviewFilter(items, mode);
  if (!list.length) return null;
  const i = list.findIndex((it) => it.no === curNo);
  if (i < 0) return dir > 0 ? list[0] : list[list.length - 1];
  const j = i + dir;
  if (j < 0 || j >= list.length) return null;
  return list[j];
}

export function markedNos(items: ExamReportFullItem[] | undefined): number[] {
  return (items || []).filter((it) => it && it.marked && typeof it.no === 'number').map((it) => it.no);
}

/** 连看过滤三态循环：all→wrong→marked→all；无标记题时跳过 marked */
export function nextNavMode(mode: NavMode, hasMarks: boolean): NavMode {
  if (mode === 'all') return 'wrong';
  if (mode === 'wrong') return hasMarks ? 'marked' : 'all';
  return 'all';
}

export const NAV_MODE_LABEL: Record<NavMode, string> = { all: '全部题目', wrong: '只看错题/未答', marked: '只看标记题' };

export function goalGap(score: number | null | undefined, target: number | null | undefined): { target: number; gap: number } | null {
  const s = Number(score);
  const t = Number(target);
  if (score == null || target == null || !Number.isFinite(s) || !Number.isFinite(t) || t <= 0) return null;
  return { target: t, gap: Math.round((t - s) * 10) / 10 };
}

export function prevScoreDelta(history: ExamAttempt[], curId: number): { prev: number; delta: number } | null {
  const i = history.findIndex((a) => a && a.id === curId);
  if (i <= 0) return null;
  const prev = history[i - 1];
  const cur = history[i];
  if (!prev || prev.score == null || !cur || cur.score == null) return null;
  return { prev: Number(prev.score), delta: Math.round((Number(cur.score) - Number(prev.score)) * 10) / 10 };
}

export function modAvgPct(rank: ExamRankFull | null, key: string): number | null {
  if (!rank || !rank.module_avg) return null;
  const m = rank.module_avg[key];
  if (!m) return null;
  const pct = Number(m.pct);
  const n = Number(m.n_users);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;
  if (!Number.isFinite(n) || n < 2) return null;
  return Math.round(pct);
}

export interface ModuleRow {
  key: string;
  name: string;
  n: number;
  correct: number;
  pct: number;
  avgPct: number | null;
  answered?: number;
  ansPct?: number;
}

const PRACTICE_MODS = MOD_ORDER;
const MIN_GAP = 5;
const LOW_PCT = 60;
const MIN_N = 3;

function validPct(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
}

/** 判定样本：按已答题数与已答正确率（answered=0 整模块未答不判）；无 answered 字段回落 n/pct */
function judgePct(m: ModuleRow): number | null {
  const cnt = m.answered == null ? m.n : m.answered;
  if (!Number.isFinite(cnt) || cnt < MIN_N) return null;
  const pct = m.ansPct == null ? m.pct : m.ansPct;
  return validPct(pct) ? pct : null;
}

/** 部分作答时兜底文案附折算说明，与 paceRows refNote / H5 exam-weak.js 同写法 */
function partialNote(m: ModuleRow): string {
  return m.answered != null && m.answered < m.n ? '（按已答 ' + m.answered + '/' + m.n + ' 题折算）' : '';
}

/** 薄弱模块：优先「低于全站均值 ≥5 个百分点」最大者，否则全卷最低且 <60%（与 H5 exam-weak.js 同口径） */
export function weakModule(modules: ModuleRow[]): { key: string; name: string; reason: string } | null {
  const rows: Array<{ m: ModuleRow; pct: number }> = [];
  for (const m of modules) {
    if (!m || !PRACTICE_MODS.includes(m.key)) continue;
    const pct = judgePct(m);
    if (pct != null) rows.push({ m, pct });
  }
  if (!rows.length) return null;
  let best: { m: ModuleRow; gap: number } | null = null;
  for (const r of rows) {
    if (!validPct(r.m.avgPct)) continue;
    const gap = r.m.avgPct - r.pct;
    if (gap >= MIN_GAP && (!best || gap > best.gap)) best = { m: r.m, gap };
  }
  if (best) return { key: best.m.key, name: best.m.name || best.m.key, reason: '低于全站均值 ' + Math.round(best.gap) + ' 个百分点' };
  const low = rows.slice().sort((a, b) => a.pct - b.pct)[0];
  if (low && low.pct < LOW_PCT) {
    return { key: low.m.key, name: low.m.name || low.m.key, reason: '本卷正确率 ' + low.pct + '%，全卷最低' + partialNote(low.m) };
  }
  return null;
}

export interface NextReco {
  id: number;
  title: string;
  year: number | null;
  region: string;
  takers: number;
  avgScore: number | null;
}

function posInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

/** 推荐下一卷：未考过 → 同地区优先 → 年份新 → 考过人多 */
export function nextPaper(papers: ExamPaper[], attempts: ExamAttempt[], cur: ExamPaperInfo): NextReco | null {
  if (!cur || !posInt(cur.id)) return null;
  const done = new Set<number>([cur.id]);
  for (const a of attempts || []) if (a && posInt(a.paper_id)) done.add(a.paper_id);
  const rows = papers.filter((p) => p && posInt(p.id) && typeof p.title === 'string' && p.title.trim() && !done.has(p.id));
  if (!rows.length) return null;
  const yearOf = (p: ExamPaper) => (posInt(p.year) ? p.year : 0);
  const takersOf = (p: ExamPaper) => (typeof p.takers === 'number' && Number.isFinite(p.takers) && p.takers > 0 ? p.takers : 0);
  const sameRegion = (p: ExamPaper) => (cur.region && p.region === cur.region ? 1 : 0);
  const best = rows
    .slice()
    .sort((a, b) => sameRegion(b) - sameRegion(a) || yearOf(b) - yearOf(a) || takersOf(b) - takersOf(a) || b.id - a.id)[0];
  return {
    id: best.id,
    title: best.title.trim(),
    year: posInt(best.year) ? best.year : null,
    region: best.region || '',
    takers: takersOf(best),
    avgScore: typeof best.avg_score === 'number' && Number.isFinite(best.avg_score) ? best.avg_score : null,
  };
}

export interface BoardRow {
  rank: number;
  name: string;
  score: number;
  me: boolean;
}

/** 同卷排行榜（每人最高分口径）；本人不在 Top10 时追加一行「我」 */
export function examBoardRows(rank: ExamRankFull | null): BoardRow[] | null {
  if (!rank || !Array.isArray(rank.board)) return null;
  const rows: BoardRow[] = rank.board
    .filter((r) => r && Number.isFinite(Number(r.score)))
    .map((r) => ({ rank: Number(r.rank) || 0, name: String(r.name || ''), score: Number(r.score), me: !!r.me }));
  if (rows.length < 2) return null;
  if (!rows.some((r) => r.me) && rank.rank > 0 && Number.isFinite(Number(rank.score))) {
    rows.push({ rank: rank.rank, name: '我', score: Number(rank.score), me: true });
  }
  return rows;
}

export function fmtSecsText(s: number | null | undefined): string | null {
  if (typeof s !== 'number' || !isFinite(s) || s <= 0) return null;
  const v = Math.round(s);
  if (v < 60) return v + ' 秒';
  const m = Math.floor(v / 60);
  const r = v % 60;
  return r ? m + ' 分 ' + r + ' 秒' : m + ' 分';
}

export function qTimeLine(secs: number | null | undefined, avgSecs: number | null): string {
  const own = fmtSecsText(secs);
  if (!own) return '';
  const avg = fmtSecsText(avgSecs);
  return avg ? '本题用时 ' + own + ' · 全卷平均 ' + avg + '/题' : '本题用时 ' + own;
}

export function qStatLine(q: { attempt_count?: number; correct_ratio?: number | null; most_wrong?: string | null; answer?: string } | null): string {
  if (!q || !q.attempt_count || q.attempt_count < 5 || q.correct_ratio == null) return '';
  const r = q.correct_ratio;
  const d = r > 85 ? 1 : r > 70 ? 2 : r > 55 ? 3 : r > 40 ? 4 : 5;
  let s = `难度${'★'.repeat(d)} · 全站正确率 ${r}%（${q.attempt_count} 人次）`;
  if (q.most_wrong && q.most_wrong !== q.answer) s += ` · 易错项 ${q.most_wrong}`;
  return s;
}

export function usedTimeText(startedAt: number, submittedAt: number | null | undefined): string {
  if (!submittedAt) return '-';
  const s = Math.max(0, Math.round(submittedAt - startedAt));
  return Math.floor(s / 60) + ' 分 ' + (s % 60) + ' 秒';
}

// ---------- 统计页「模考成绩趋势」（对齐 H5 exam-trend.js） ----------
export interface ExamTrendPoint {
  id: number;
  score: number;
  kind: string;
  t: number;
  heightPct: number;
  level: 'ok' | 'warn' | 'bad';
}

export interface ExamTrend {
  points: ExamTrendPoint[];
  scaleMax: number;
  best: number;
  latest: number;
  target: number | null;
  targetPct: number | null;
}

export function examTrend(items: ExamAttempt[] | null | undefined, target: number | null | undefined, cap = 10): ExamTrend | null {
  if (!Array.isArray(items)) return null;
  const base = items
    .filter((a) => a && a.score != null && Number.isFinite(Number(a.score)) && a.submitted_at)
    .slice(0, cap)
    .reverse()
    .map((a) => ({ id: a.id, score: Math.round(Number(a.score) * 10) / 10, kind: a.kind === 'mock' ? 'mini' : 'full', t: Number(a.submitted_at) }));
  if (base.length < 2) return null;
  const g = goalGap(0, target);
  const t = g ? g.target : null;
  const raw = Math.max(...base.map((p) => p.score), t || 0, 10);
  const scaleMax = Math.min(100, Math.ceil(raw / 10) * 10);
  const points: ExamTrendPoint[] = base.map((p) => ({
    ...p,
    heightPct: Math.max((p.score / scaleMax) * 100, 4),
    level: p.score < scaleMax * 0.6 ? 'bad' : p.score < scaleMax * 0.8 ? 'warn' : 'ok',
  }));
  return {
    points,
    scaleMax,
    best: Math.max(...points.map((p) => p.score)),
    latest: points[points.length - 1].score,
    target: t,
    targetPct: t && t <= scaleMax ? Math.round((t / scaleMax) * 1000) / 10 : null,
  };
}
