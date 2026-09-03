// 复习轮末小结统计（fail-closed 纯函数）：仅消费 item 上的 _res 首答判分留痕

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
  }
  const judged = s.dueRight + s.dueWrong;
  if (judged > 0) s.pct = Math.round((s.dueRight / judged) * 100);
  return s;
}
