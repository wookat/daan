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
