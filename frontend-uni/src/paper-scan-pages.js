// 扫描答题卡结果 sheet 的多页卷口径：后端 scan_sheet 只判上传那一页（page），pages 为整卷答题卡页数（PER_PAGE=50 分页）。
export function scanPageLabel(r) {
  const page = Number(r && r.page) || 0;
  if (page <= 0) return '';
  const pages = Number(r && r.pages) || 0;
  return pages > 1 ? '第 ' + page + '/' + pages + ' 页' : '第 ' + page + ' 页';
}

export function scanPagesNote(r) {
  const page = Number(r && r.page) || 0;
  const pages = Number(r && r.pages) || 0;
  const total = Number(r && r.total) || 0;
  if (page <= 0 || pages <= 1 || total <= 0) return '';
  const first = (r.items && r.items.length && Number(r.items[0].no)) || 0;
  const a = first > 0 ? first : 1;
  const b = a + total - 1;
  return '本卷答题卡共 ' + pages + ' 页，本页只判第 ' + a + '–' + b + ' 题；其余页请分别扫描';
}
