// 模考成绩报告 → 错题重练题组构建（practice.vue redoSet 兼容格式）
export function buildExamRedoSet(items, limit = 10) {
  const list = Array.isArray(items) ? items : [];
  const out = [];
  for (const it of list) {
    if (!it || !it.picked || it.correct) continue;
    if (!it.question_id || !it.question || !it.options || !it.answer) continue;
    out.push({
      id: it.question_id,
      question: it.question,
      options: it.options,
      answer: it.answer,
      explanation: it.explanation || '',
      hs_explanation: it.hs_explanation || '',
      module: it.module || null,
      submodule: it.submodule || null,
      image: it.image || null,
      image_credit: it.image_credit || null,
    });
    if (out.length >= limit) break;
  }
  return out;
}
