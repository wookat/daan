// 成绩报告考中标记纯函数：fail-closed，旧报告/无标记不改变既有行为。

/** 报告 items 中考中标记题的题号列表（非数组/无标记返回 []）。 */
export function markedNos(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((it) => it && it.marked && typeof it.no === 'number').map((it) => it.no);
}

/** 连看过滤三态循环：all→wrong→marked→all；无标记题时跳过 marked 档（兼容旧报告）。 */
export function nextNavMode(mode, hasMarks) {
  if (mode === 'all') return 'wrong';
  if (mode === 'wrong') return hasMarks ? 'marked' : 'all';
  return 'all';
}
