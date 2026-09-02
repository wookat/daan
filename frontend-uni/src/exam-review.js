// 成绩报告解析复盘：过滤序列与逐题步进
export function reviewFilter(items, wrongOnly) {
  const list = Array.isArray(items) ? items : [];
  return wrongOnly ? list.filter((it) => it && !it.correct) : list;
}

export function reviewStep(items, curNo, dir, wrongOnly) {
  const list = reviewFilter(items, wrongOnly);
  if (!list.length || (dir !== 1 && dir !== -1)) return null;
  const i = list.findIndex((it) => it.no === curNo);
  if (i < 0) return dir > 0 ? list[0] : list[list.length - 1];
  const j = i + dir;
  if (j < 0 || j >= list.length) return null;
  return list[j];
}
