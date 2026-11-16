// 成绩报告解析复盘：过滤序列与逐题步进
// mode: 'all' 全部 | 'wrong' 只看错题/未答 | 'marked' 只看考中标记题
// 兼容旧布尔调用：true → 'wrong'，false → 'all'
export function reviewFilter(items, mode) {
  const list = Array.isArray(items) ? items : [];
  const m = mode === true ? 'wrong' : mode === 'marked' || mode === 'wrong' ? mode : 'all';
  if (m === 'wrong') return list.filter((it) => it && !it.correct);
  if (m === 'marked') return list.filter((it) => it && it.marked);
  return list;
}

export function reviewStep(items, curNo, dir, mode) {
  const list = reviewFilter(items, mode);
  if (!list.length || (dir !== 1 && dir !== -1)) return null;
  const i = list.findIndex((it) => it.no === curNo);
  if (i < 0) return dir > 0 ? list[0] : list[list.length - 1];
  const j = i + dir;
  if (j < 0 || j >= list.length) return null;
  return list[j];
}
