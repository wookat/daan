// 练习页「退出」按钮文案：leave() 在页面栈 >1 时 navigateBack 回上一页、否则 switchTab 首页，
// 文案按实际落点给出（从错题本重练进来显「返回错题本」，深链直达显「返回首页」），避免写「返回首页」却回了错题本。
const ROUTE_NAMES = {
  'pages/home/home': '首页',
  'pages/book/book': '错题本',
  'pages/stats/stats': '统计',
  'pages/profile/profile': '我的',
  'pkgA/exam/list': '卷库',
  'pkgA/exam/report': '成绩报告',
  'pkgA/exam/contest-report': '大赛报告',
  'pkgA/stats/weekly-report': '周报',
  'pkgA/stats/practice-history': '练习历史',
  'pkgA/stats/mastery-map': '掌握度地图',
  'pkgA/social/favorites': '收藏',
  'pkgA/search/search': '搜索',
  'pkgA/share/share-q': '队友分享',
};

export function prevRoute(pages) {
  if (!Array.isArray(pages) || pages.length < 2) return '';
  const p = pages[pages.length - 2];
  const r = (p && (p.route || (p.$page && p.$page.route))) || '';
  return String(r).replace(/^\//, '').split('?')[0];
}

export function backLabel(pages) {
  if (!Array.isArray(pages) || pages.length < 2) return '返回首页';
  const name = ROUTE_NAMES[prevRoute(pages)];
  return name ? '返回' + name : '返回';
}
