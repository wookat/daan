// AI 问答预填文本：题干 + 选项拼接，做题/复盘各入口共用口径
export function askPrefill(stem, options) {
  const s = typeof stem === 'string' ? stem.trim() : '';
  if (!s) return '';
  let opt = '';
  if (options && typeof options === 'object' && !Array.isArray(options)) {
    opt = Object.entries(options)
      .filter(([, v]) => typeof v === 'string' && v.trim())
      .map(([k, v]) => `${k}.${v}`)
      .join(' ');
  }
  return opt ? s + '\n' + opt : s;
}

// 用户作答归一化：恰好单个 A–D 字母才返回，多选/非法/空一律 ''（uanswer 仅单选语义）
export function askAnswerLetter(v) {
  const m = /[A-D]+/.exec(String(v == null ? '' : v).toUpperCase());
  if (!m) return '';
  const uniq = [...new Set(m[0])];
  return uniq.length === 1 ? uniq[0] : '';
}
