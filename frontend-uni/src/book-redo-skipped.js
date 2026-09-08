// 错题本「重练所选」：/api/mistakes/redo 对无题库原题（手录题、题干已对不回时政库）的行 fail-closed 跳过，
// 回包条数少于勾选数时给用户一句可见说明，而不是静默少题。
export function redoSkippedNote(selected, loaded) {
  const sel = Number(selected) || 0;
  const got = Number(loaded) || 0;
  const skipped = sel - got;
  if (skipped <= 0 || got <= 0) return '';
  return '已加载 ' + got + ' 题，另 ' + skipped + ' 题为手录/无题库原题，无法重练';
}
