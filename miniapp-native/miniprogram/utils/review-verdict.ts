// 复习单题作答判定文案（与 H5 review-summary.js reviewVerdict 同口径；WXML 不能调函数，在页面层算好下发）。
// `mastered` 来自服务端 /api/review/{mid} 回包：连对达阈值即移出复习计划，此时不再有「下次复习」。

/** 服务端 REVIEW_INTERVALS_DAYS 共 5 档，第 6 次连对移出复习计划（与 H5 review-summary.js MASTER_STREAK 同口径） */
export const MASTER_STREAK = 6;

/** 列表卡连对进度「连对 n/6」；0 连对或已达阈值返回 ''。 */
export function streakProgressText(streak: number | undefined): string {
  const n = Number(streak) || 0;
  return n > 0 && n < MASTER_STREAK ? `连对 ${n}/${MASTER_STREAK}` : '';
}

export interface NextReviewItem {
  id?: number | string;
  extra?: boolean;
  masteredNow?: boolean;
  nextDays?: number;
}

/**
 * 清零小结「下次复习」一句（与 H5 review-summary.js nextReviewText 同口径）：按每题服务端回的 nextDays 聚合，
 * 同一错题重出以最后一条为准、达成掌握不再排期，例「下次复习：明天 2 道 · 3 天后 1 道」；无样本返回 ''。
 */
export function nextReviewText(items: NextReviewItem[] | null | undefined): string {
  if (!Array.isArray(items)) return '';
  const byMid = new Map<string | NextReviewItem, number>();
  for (const x of items) {
    if (!x || typeof x !== 'object' || x.extra) continue;
    const d = Number(x.nextDays);
    if (!Number.isFinite(d) || d <= 0) continue;
    const key = x.id != null ? String(x.id) : x;
    if (x.masteredNow === true) byMid.delete(key);
    else byMid.set(key, Math.round(d));
  }
  const counts = new Map<number, number>();
  for (const d of byMid.values()) counts.set(d, (counts.get(d) || 0) + 1);
  if (!counts.size) return '';
  const parts = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([d, n]) => (d === 1 ? '明天' : d + ' 天后') + ' ' + n + ' 道');
  return '下次复习：' + parts.join(' · ');
}

export interface ReviewVerdictArgs {
  extra?: boolean;
  requeued?: boolean;
  wasCorrect: boolean;
  streak?: number;
  nextDays?: number;
  mastered?: boolean;
}

export function reviewVerdict(a: ReviewVerdictArgs): string {
  const streak = Number(a.streak) || 0;
  const nextDays = Number(a.nextDays) || 0;
  if (a.extra) return a.wasCorrect ? '答对了，这个考法稳了' : '还没稳，仔细看解析';
  if (a.wasCorrect && a.mastered === true) return '答对了！连对 ' + streak + ' 次 · 已掌握，移出复习计划';
  const head = a.wasCorrect
    ? a.requeued
      ? '这次答对了，本轮已纠正'
      : '答对了！连对 ' + streak + ' 次'
    : '又错了，看解析（稍后本轮会再出现）';
  return head + '（下次复习：' + nextDays + ' 天后）';
}
