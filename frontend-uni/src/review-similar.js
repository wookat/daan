// 复习流「加练同类题」条目与错题记录构造（fail-closed 纯函数）

/** /api/questions item → 复习流 _extra 加练条目；无题干返回 null。 */
export function similarItemFromQuestion(x) {
  if (!x || typeof x !== 'object' || !x.question) return null;
  const id = Number(x.id);
  const optText = Object.entries(x.options || {})
    .map(([k, v]) => `${k}.${v}`)
    .join(' ');
  return {
    _extra: true,
    question_id: Number.isInteger(id) && id > 0 ? id : null,
    module: x.module || null,
    question_type: x.question_type || x.submodule || null,
    question_text: x.question + '\n' + optText,
    correct_answer: x.answer,
    explanation: x.hs_explanation || x.explanation || '',
  };
}

/** _extra 加练条目 → POST /api/mistakes 请求体；非加练/缺题干/缺正解返回 null。 */
export function mistakeRecFromExtra(item, userAnswer, uid) {
  if (!item || item._extra !== true || !item.question_text || !item.correct_answer) return null;
  return {
    uid,
    question_id: item.question_id || null,
    module: item.module || null,
    question_type: item.question_type || null,
    question_text: item.question_text,
    user_answer: userAnswer || null,
    correct_answer: item.correct_answer,
    explanation: item.explanation || '',
  };
}
