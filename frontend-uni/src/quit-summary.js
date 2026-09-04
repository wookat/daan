// 练习中途「退出」：已答且还有未答时才值得问一句要不要保留进度；返回 null 表示直接退出即可
export function quitSummary(items, eligible) {
  if (!eligible || !Array.isArray(items) || !items.length) return null;
  const done = items.filter((q) => q && q._picked);
  if (!done.length || done.length === items.length) return null;
  const right = done.filter((q) => q._picked === q.answer).length;
  const wrong = done.length - right;
  const title = `已做 ${done.length} 题 · 答对 ${right}${wrong ? ` · ${wrong} 道进错题本` : ''}`;
  return { done: done.length, right, wrong, left: items.length - done.length, title };
}
