// 错题本 PDF 导出的个人批注（纯函数，H5/小程序共用口径）

function letters(s) {
  const m = /[A-F]+/.exec(String(s || '').toUpperCase());
  return m ? [...new Set(m[0])].sort().join('') : '';
}

/** 每题批注：错选字母（与标准答案相同时不算错答）+ 已标错因；都没有返回 {}。 */
export function exportNote(m) {
  const out = {};
  const picked = letters(m && m.user_answer);
  if (picked && picked !== letters(m.correct_answer)) out.picked = picked;
  const reason = String((m && m.error_reason) || '').trim();
  if (reason) out.reason = reason;
  return out;
}

/** 题库题批注表 `{question_id: note}`，供 /api/export/pdf `mistakes` 字段；无批注返回 null。 */
export function exportNotesMap(list, withNotes) {
  if (!withNotes) return null;
  const out = {};
  for (const m of list || []) {
    if (!m || !m.question_id) continue;
    const nt = exportNote(m);
    if (Object.keys(nt).length) out[m.question_id] = nt;
  }
  return Object.keys(out).length ? out : null;
}
