// 练习页完成态「曾错题复习推进」汇总（与 H5 frontend-uni/src/review-advance.js 同口径）
// 数据源 = /api/answer_log 回包 reviewed（服务端 R371 统一推进 SRS，客户端只汇总不判分）
import type { AnswerLogReviewed } from '../api/types';

export interface RedoReport {
  fixed: number;
  still: number;
  mastered: number;
}

export interface FixReport {
  n: number;
  mastered: number;
}

interface AnsweredLike {
  _picked?: string;
  answer?: string;
  mistake_id?: number;
}

/** reviewed 里本次达成掌握（mastered 严判 true，脏值/老后端 fail-closed 计 0）的题数 */
export function reviewedMasteredCount(reviewed: unknown): number {
  if (!Array.isArray(reviewed)) return 0;
  let n = 0;
  for (const r of reviewed as Array<Partial<AnswerLogReviewed> | null>) {
    if (r && r.mastered === true) n++;
  }
  return n;
}

/** 错题重练（redo / 错题本重练所选）：按带 mistake_id 的已答题统计已纠正 / 仍错；无此类题回 null 让调用方走 fixReport */
export function redoReportOf(items: AnsweredLike[], reviewed: unknown): RedoReport | null {
  const answered = (items || []).filter((q) => q && q._picked && q.mistake_id);
  if (!answered.length) return null;
  const fixed = answered.filter((q) => q._picked === q.answer).length;
  return { fixed, still: answered.length - fixed, mastered: reviewedMasteredCount(reviewed) };
}

/** 普通练习里顺带答对曾错题：n = reviewed 条数；0 条回 null 不显示 */
export function fixReportOf(reviewed: unknown): FixReport | null {
  if (!Array.isArray(reviewed) || !reviewed.length) return null;
  return { n: reviewed.length, mastered: reviewedMasteredCount(reviewed) };
}

export function fixReportText(rep: FixReport | null): string {
  if (!rep || !(rep.n > 0)) return '';
  let s = '本组答对 ' + rep.n + ' 道曾错题，复习计划已推进';
  if (rep.mastered > 0) s += '（' + rep.mastered + ' 道达成掌握）';
  return s;
}

export function redoReportTip(rep: RedoReport | null): string {
  if (!rep) return '';
  let s = '答对的已推进复习计划';
  if (rep.still > 0) s += '；仍错的已重置复习，已回到今日待复习';
  return s;
}
