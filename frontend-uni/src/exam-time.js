// 成绩报告逐题用时锚点纯函数：fail-closed，数据不足不渲染不伪造。

/** 秒数格式化：45 → '45 秒'，80 → '1 分 20 秒'，120 → '2 分'；非正数/非法返回 null。 */
export function fmtSecs(s) {
  if (typeof s !== 'number' || !isFinite(s) || s <= 0) return null;
  const v = Math.round(s);
  if (v < 60) return v + ' 秒';
  const m = Math.floor(v / 60);
  const r = v % 60;
  return r ? m + ' 分 ' + r + ' 秒' : m + ' 分';
}

/** 全卷平均每题用时（秒）：仅统计 secs>0 的题，有效题 <3 返回 null（防小样本误导）。 */
export function paperAvgSecs(items) {
  if (!Array.isArray(items)) return null;
  const vals = items
    .map((it) => it && it.secs)
    .filter((s) => typeof s === 'number' && isFinite(s) && s > 0);
  if (vals.length < 3) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/** 浮层用时文案：'本题用时 45 秒 · 全卷平均 38 秒/题'；本题无有效用时返回 null。 */
export function qTimeLine(secs, avgSecs) {
  const own = fmtSecs(secs);
  if (!own) return null;
  const avg = fmtSecs(avgSecs);
  return avg ? '本题用时 ' + own + ' · 全卷平均 ' + avg + '/题' : '本题用时 ' + own;
}
