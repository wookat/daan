// 申论作答限字：从题面解析字数要求并对作答长度判色
export function parseWordLimit(text) {
  const s = String(text || '');
  let m = s.match(/不超过\s*(\d+)\s*字/);
  if (m) return { label: '≤' + m[1] + '字', max: parseInt(m[1], 10) };
  m = s.match(/(\d+)\s*[～~—\-至]\s*(\d+)\s*字/);
  if (m) return { label: m[1] + '–' + m[2] + '字', max: parseInt(m[2], 10) };
  m = s.match(/(\d+)\s*字左右/);
  if (m) return { label: m[1] + '字左右', max: 0 };
  m = s.match(/不少于\s*(\d+)\s*字/);
  if (m) return { label: '≥' + m[1] + '字', max: 0 };
  return null;
}

export function wordState(len, lim) {
  if (!lim || !lim.max) return '';
  if (len > lim.max) return 'over';
  if (len >= lim.max * 0.9) return 'near';
  return '';
}
