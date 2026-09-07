// 复习作答卡选项行（fail-closed 纯函数）：/api/review 联查题库时 question_text 只剩规范题干、
// 选项在结构化 options 里，作答卡必须把选项文本铺出来；无结构化选项（手录/加练/时政）退回裸字母。

const LETTERS = ['A', 'B', 'C', 'D'];

/** 复习条目 → [{ k, t }]；t 为空串时模板只显示字母。 */
export function reviewOptions(cur) {
  const o = cur && typeof cur === 'object' ? cur.options : null;
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    const ks = Object.keys(o)
      .filter((k) => /^[A-Z]$/.test(k) && typeof o[k] === 'string' && o[k].trim())
      .sort();
    if (ks.length >= 2) return ks.map((k) => ({ k, t: o[k].trim() }));
  }
  return LETTERS.map((k) => ({ k, t: '' }));
}

/** 选项文本是否需要整行铺出（有任一非空文本）。 */
export function reviewOptionsFull(opts) {
  return Array.isArray(opts) && opts.some((x) => x && x.t);
}
