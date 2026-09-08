// 错题重练开场说明（与 H5 book-redo-skipped.js 同口径）：
// /api/mistakes/redo 对手录 / 题已下线 / 题干对不回时政库的行 fail-closed 跳过并回 skipped，
// 回包条数少于应重练数时给用户一句可见说明，而不是静默少题。

export function redoSkippedNote(expected: number, loaded: number): string {
  const exp = Number(expected) || 0;
  const got = Number(loaded) || 0;
  const skipped = exp - got;
  if (skipped <= 0 || got <= 0) return '';
  return '已加载 ' + got + ' 题，另 ' + skipped + ' 题为手录/无题库原题，无法重练';
}
