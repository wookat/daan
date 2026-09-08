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

/** 服务端 /api/review 单次下发上限（与 H5 review-summary.js REVIEW_BATCH 同口径） */
export const REVIEW_BATCH = 20;
/** 答错自动加练同类题每轮总上限（与 H5 REVIEW_EXTRA_MAX 同口径） */
export const REVIEW_EXTRA_MAX = 6;

/** 本轮还能再追加几道加练同类题（0 表示已达上限）。 */
export function similarRoom(items: Array<{ extra?: boolean }> | null | undefined, perItem = 2, max = REVIEW_EXTRA_MAX): number {
  const extra = Array.isArray(items) ? items.filter((x) => x && x.extra).length : 0;
  return Math.max(0, Math.min(perItem, max - extra));
}

/** 一组做完后剩余到期数的本地估算（服务端重拉前先显示）。 */
export function reviewDueLeft(dueTotal: number | undefined, done: number | undefined): number {
  return Math.max(0, (Number(dueTotal) || 0) - (Number(done) || 0));
}

export interface ReviewDoneCopy {
  cleared: boolean;
  title: string;
  line: string;
  cta: string;
}

/** 一组复习完成后的小结口径（与 H5 reviewDoneCopy 同口径）：剩余到期 >0 不宣称「清零」。 */
export function reviewDoneCopy(done: number | undefined, left: number | undefined): ReviewDoneCopy {
  const n = Number(done) || 0;
  const l = Math.max(0, Number(left) || 0);
  if (l > 0) {
    return {
      cleared: false,
      title: '本组复习完成',
      line: `本组 ${n} 道复习完成 · 还有 ${l} 道到期待复习`,
      cta: `继续复习下一组（${Math.min(l, REVIEW_BATCH)} 道）›`,
    };
  }
  return { cleared: true, title: '今日复习已清零！', line: `${n} 道到期错题全部复习完成，遗忘曲线稳住了`, cta: '' };
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
