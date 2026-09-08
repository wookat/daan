// 复习轮末小结统计（fail-closed 纯函数）：仅消费 item 上的 _res 首答判分留痕

/** 服务端 REVIEW_INTERVALS_DAYS 共 5 档，第 6 次连对移出复习计划（mastered） */
export const MASTER_STREAK = 6;

/** 列表卡连对进度「连对 n/6」；0 连对或已达阈值（已掌握另有标签）返回 ''。 */
export function streakProgressText(streak) {
  const n = Number(streak) || 0;
  return n > 0 && n < MASTER_STREAK ? `连对 ${n}/${MASTER_STREAK}` : '';
}

/** 单题作答判定文案；`mastered` 为服务端 /api/review/{mid} 回包（连对达阈值即移出复习计划，不再有「下次复习」）。 */
export function reviewVerdict({ extra, requeued, wasCorrect, streak, nextDays, mastered }) {
  if (extra) return wasCorrect ? '答对了，这个考法稳了 ✓' : '还没稳，仔细看讲解';
  if (wasCorrect && mastered === true) return '答对了！连对 ' + (Number(streak) || 0) + ' 次 · 已掌握，移出复习计划 ✓';
  const head = wasCorrect
    ? requeued
      ? '这次答对了，本轮已纠正 ✓'
      : '答对了！连对 ' + (Number(streak) || 0) + ' 次'
    : '又错了，看讲解（稍后本轮会再出现）';
  return head + '（下次复习：' + (Number(nextDays) || 0) + ' 天后）';
}

/**
 * 清零小结「下次复习」一句：按每题服务端回的 `_nextDays`（非加练、未掌握、最后一次作答的条目）聚合，
 * 例：「下次复习：明天 2 道 · 3 天后 1 道」；没有天数样本返回 ''。同一错题重出（_requeued）以最后一条为准。
 */
export function nextReviewText(rItems) {
  if (!Array.isArray(rItems)) return '';
  const byMid = new Map();
  for (const x of rItems) {
    if (!x || typeof x !== 'object' || x._extra) continue;
    const d = Number(x._nextDays);
    if (!Number.isFinite(d) || d <= 0) continue;
    const key = x.id != null ? String(x.id) : x;
    if (x._mastered === true) byMid.delete(key);
    else byMid.set(key, Math.round(d));
  }
  const counts = new Map();
  for (const d of byMid.values()) counts.set(d, (counts.get(d) || 0) + 1);
  if (!counts.size) return '';
  const parts = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([d, n]) => (d === 1 ? '明天' : d + ' 天后') + ' ' + n + ' 道');
  return '下次复习：' + parts.join(' · ');
}

/** 服务端 /api/review 单次下发上限（due_reviews limit），一组复习即一批。 */
export const REVIEW_BATCH = 20;
/** 答错自动加练同类题每轮总上限（每题最多 2 道），复习会话有界、不随错题数线性膨胀。 */
export const REVIEW_EXTRA_MAX = 6;

/** 本轮还能再追加几道加练同类题（0 表示已达上限）。 */
export function similarRoom(rItems, perItem = 2, max = REVIEW_EXTRA_MAX) {
  const extra = Array.isArray(rItems) ? rItems.filter((x) => x && typeof x === 'object' && x._extra).length : 0;
  return Math.max(0, Math.min(perItem, max - extra));
}

/** 一组做完后剩余到期数的本地估算（服务端重拉前先显示）：到期总数 − 本组到期条目数，下限 0。 */
export function reviewDueLeft(dueTotal, done) {
  return Math.max(0, (Number(dueTotal) || 0) - (Number(done) || 0));
}

/**
 * 一组复习完成后的小结口径：到期总数超过一组时不宣称「清零」。
 * left>0 → 本组完成 + 剩余到期 + 「继续下一组」CTA；left=0 → 今日清零（原文案）。
 */
export function reviewDoneCopy(done, left) {
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
  return { cleared: true, title: '今日复习已清零', line: `${n} 道到期错题全部复习完成，遗忘曲线稳住了`, cta: '' };
}

/** rItems → 本轮小结；非数组/空返回 null。无 _res 的条目不计入对应分子分母。 */
export function reviewSummary(rItems) {
  if (!Array.isArray(rItems) || rItems.length === 0) return null;
  const s = {
    due: 0,
    dueRight: 0,
    dueWrong: 0,
    corrected: 0,
    uncorrected: 0,
    extra: 0,
    extraRight: 0,
    extraWrong: 0,
    mastered: 0,
    pct: null,
  };
  for (const x of rItems) {
    if (!x || typeof x !== 'object') continue;
    if (x._extra) {
      s.extra++;
      if (x._res === true) s.extraRight++;
      else if (x._res === false) s.extraWrong++;
    } else if (x._requeued) {
      if (x._res === true) s.corrected++;
      else if (x._res === false) s.uncorrected++;
    } else {
      s.due++;
      if (x._res === true) s.dueRight++;
      else if (x._res === false) s.dueWrong++;
    }
    if (!x._extra && x._mastered === true) s.mastered++;
  }
  const judged = s.dueRight + s.dueWrong;
  if (judged > 0) s.pct = Math.round((s.dueRight / judged) * 100);
  return s;
}
