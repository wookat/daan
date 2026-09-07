// 申论专区纯函数（与 H5 shenlun-qfav/qnav/words/draft.js 逐函数对齐）
import type { ShenlunQFavsResp, ShenlunQuestion } from '../api/exam-types';

export const QTYPES = ['全部', '归纳概括', '综合分析', '提出对策', '贯彻执行', '大作文'];
export const MTYPES = ['全部', '金句', '案例', '政策理论', '范文'];
export const QFAV_IDS_KEY = 'slQFavIds';
export const QFAV_SNAPS_KEY = 'slQFavs';
export const MFAV_IDS_KEY = 'slMatFavIds';
export const MFAV_SNAPS_KEY = 'slMatFavs';
export const draftKey = (qid: number) => 'slDraft:' + qid;

const QFAV_LIMIT = 200;

export interface QFavState {
  ids: number[];
  snaps: ShenlunQuestion[];
}

export function toQFavSnap(q: ShenlunQuestion): ShenlunQuestion {
  return { id: q.id, qtype: q.qtype, paper: q.paper, exam_year: q.exam_year, exam_region: q.exam_region, question: q.question };
}

export function toggleQFav(state: QFavState, q: ShenlunQuestion): QFavState & { added: boolean } {
  const ids = state.ids.slice();
  const snaps = state.snaps.slice();
  const id = Number(q.id);
  if (!Number.isInteger(id) || id <= 0) return { ids, snaps, added: false };
  const i = ids.indexOf(id);
  if (i >= 0) {
    ids.splice(i, 1);
    return { ids, snaps: snaps.filter((x) => x && x.id !== id), added: false };
  }
  ids.push(id);
  snaps.unshift(toQFavSnap(q));
  if (snaps.length > QFAV_LIMIT) snaps.length = QFAV_LIMIT;
  return { ids, snaps, added: true };
}

export function mergeQFavSync(local: QFavState, server: ShenlunQFavsResp): QFavState & { pushIds: number[] } {
  const serverIds = Array.isArray(server.ids) ? server.ids : [];
  const serverItems = Array.isArray(server.items) ? server.items : [];
  const pushIds = local.ids.filter((id) => !serverIds.includes(id));
  const snaps = [
    ...local.snaps.filter((x) => x && pushIds.includes(x.id)),
    ...serverItems.filter((x) => x && !pushIds.includes(x.id)),
  ];
  if (snaps.length > QFAV_LIMIT) snaps.length = QFAV_LIMIT;
  const have = new Set(snaps.map((x) => x.id));
  const ids = [...snaps.map((x) => x.id), ...local.ids.filter((id) => !have.has(id) && !serverIds.includes(id))];
  return { ids, snaps, pushIds };
}

export function missingSnapIds(ids: number[], snaps: ShenlunQuestion[]): number[] {
  const have = new Set(snaps.map((x) => x && x.id));
  return ids.filter((id) => !have.has(id));
}

export interface QNav {
  idx: number;
  total: number;
  prevId: number;
  nextId: number;
}

export function qNavState(ids: number[], curId: number): QNav {
  const i = ids.indexOf(curId);
  if (i < 0) return { idx: -1, total: ids.length, prevId: 0, nextId: 0 };
  return { idx: i, total: ids.length, prevId: i > 0 ? ids[i - 1] : 0, nextId: i < ids.length - 1 ? ids[i + 1] : 0 };
}

export interface WordLimit {
  label: string;
  max: number;
}

export function parseWordLimit(text: string | null | undefined): WordLimit | null {
  const s = String(text || '');
  let m = s.match(/不超过\s*(\d+)\s*字/);
  if (m) return { label: '≤' + m[1] + '字', max: parseInt(m[1], 10) };
  m = s.match(/(\d+)\s*[～~—\-至]\s*(\d+)\s*字/);
  if (m) return { label: m[1] + '–' + m[2] + '字', max: parseInt(m[2], 10) };
  m = s.match(/(\d+)\s*字左右/);
  if (m) return { label: m[1] + '字左右', max: 0 };
  m = s.match(/不少于\s*(\d+)\s*字/);
  if (m) return { label: '≥' + m[1] + '字', max: 0 };
  return null;
}

export function wordState(len: number, lim: WordLimit | null): '' | 'near' | 'over' {
  if (!lim || !lim.max) return '';
  if (len > lim.max) return 'over';
  if (len >= lim.max * 0.9) return 'near';
  return '';
}

/** 本地草稿为空时才采用服务端草稿（本地优先） */
export function adoptServerDraft(localContent: string, server: { content?: string | null } | null | undefined): string | null {
  if (localContent) return null;
  const remote = server && typeof server.content === 'string' ? server.content : '';
  return remote || null;
}

/** 卡片脚注：从题干提取「x 分 · ≤y 字」 */
export function qMeta(text: string | null | undefined): string {
  const s = String(text || '');
  const score = (s.match(/(\d+)\s*分/) || [])[1];
  const words = (s.match(/不超过\s*(\d+)\s*字/) || [])[1];
  const parts: string[] = [];
  if (score) parts.push(score + ' 分');
  if (words) parts.push('≤' + words + ' 字');
  return parts.join(' · ');
}

export function fmtTime(ts: number | null | undefined): string {
  const d = new Date((ts || 0) * 1000);
  const p = (n: number) => (n < 10 ? '0' + n : String(n));
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

export function readIds(key: string): number[] {
  const v = wx.getStorageSync(key);
  return Array.isArray(v) ? (v as number[]) : [];
}

export function readSnaps<T>(key: string): T[] {
  const v = wx.getStorageSync(key);
  return Array.isArray(v) ? (v as T[]) : [];
}
