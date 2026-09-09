// 练习页「返回」文案：onQuit 走 navigateBack（栈 1 页时 fail → switchTab 首页），文案按实际落点给出
// （错题本重练进来显「返回错题本」，分享/扫码直达显「返回首页」），与 H5 back-label.js 同口径。
const ROUTE_NAMES: Record<string, string> = {
  'pages/home/home': '首页',
  'pages/book/book': '错题本',
  'pages/stats/stats': '统计',
  'pages/profile/profile': '我的',
  'pages/share/share': '队友分享',
  'pkgExam/list/list': '卷库',
  'pkgExam/report/report': '成绩报告',
  'pkgExam/contest-report/contest-report': '大赛报告',
  'pkgGrow/daily/daily': '每日一练',
  'pkgGrow/weekly-report/weekly-report': '周报',
  'pkgGrow/mastery-map/mastery-map': '掌握度地图',
  'pkgLearn/practice-history/practice-history': '练习历史',
  'pkgLearn/search/search': '搜索',
  'pkgLearn/setup/setup': '练习设置',
};

export function prevRoute(pages: ReadonlyArray<{ route?: string }> | undefined): string {
  if (!Array.isArray(pages) || pages.length < 2) return '';
  const r = pages[pages.length - 2]?.route || '';
  return String(r).replace(/^\//, '').split('?')[0];
}

export function backLabel(pages: ReadonlyArray<{ route?: string }> | undefined): string {
  if (!Array.isArray(pages) || pages.length < 2) return '返回首页';
  const name = ROUTE_NAMES[prevRoute(pages)];
  return name ? `返回${name}` : '返回';
}
