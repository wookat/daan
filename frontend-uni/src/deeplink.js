// 根路径查询深链归一化：/?daily=1[&date=…][&src=…] 是对外短链（推送/分享），
// uni h5 router 只识别 hash 路由，启动前需改写为练习页 hash 深链。
// 返回目标 hash 深链字符串；无需归一化时返回 null。
export function normalizeDailyDeepLink(search, hash) {
  const qs = new URLSearchParams(search || '');
  if (!qs.get('daily')) return null;
  if (hash && hash !== '#/' && hash !== '#') return null;
  const date = qs.get('date');
  const src = qs.get('src');
  return (
    '#/pages/practice/practice?daily=1' +
    (date ? '&date=' + encodeURIComponent(date) : '') +
    (src ? '&src=' + encodeURIComponent(src) : '')
  );
}
