// 真题卷库 URL 同步：year/region 筛选状态生成可刷新恢复的 hash 深链
export const EXAM_LIST_PATH = '/#/pkgA/exam/list';

export function buildExamListUrl(f) {
  const o = f || {};
  const parts = [];
  const y = Number(o.year);
  if (Number.isInteger(y) && y >= 1990 && y <= 2099) parts.push('year=' + y);
  const r = typeof o.region === 'string' ? o.region.trim() : '';
  if (r) parts.push('region=' + encodeURIComponent(r));
  return parts.length ? EXAM_LIST_PATH + '?' + parts.join('&') : EXAM_LIST_PATH;
}

export function parseExamListOpts(opts) {
  const o = opts || {};
  const y = Number(o.year);
  let region = '';
  try {
    region = typeof o.region === 'string' ? decodeURIComponent(o.region).trim() : '';
  } catch {
    region = '';
  }
  const pid = Number(o.pid);
  return {
    year: Number.isInteger(y) && y >= 1990 && y <= 2099 ? y : 0,
    region,
    pid: Number.isInteger(pid) && pid > 0 ? pid : 0,
  };
}
