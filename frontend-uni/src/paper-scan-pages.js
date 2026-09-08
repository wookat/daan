// 扫描答题卡结果 sheet 的多页卷口径：后端 scan_sheet 只判上传那一页（page），pages 为整卷答题卡页数（PER_PAGE=50 分页）。
export function scanPageLabel(r) {
  const page = Number(r && r.page) || 0;
  if (page <= 0) return '';
  const pages = Number(r && r.pages) || 0;
  return pages > 1 ? '第 ' + page + '/' + pages + ' 页' : '第 ' + page + ' 页';
}

// 本次进页以来各页扫描结果的页内计数（按卷码 → 页号；同页重扫覆盖；手动录入回包无 page 不计）。
export function recordScanPage(acc, r) {
  const page = Number(r && r.page) || 0;
  const pages = Number(r && r.pages) || 0;
  const code = (r && r.code) || '';
  if (page <= 0 || pages <= 1 || !code) return acc || {};
  const cur = { ...(acc || {}) };
  cur[code] = {
    ...(cur[code] || {}),
    [page]: { answered: Number(r.answered) || 0, correct: Number(r.correct) || 0, total: Number(r.total) || 0 },
  };
  return cur;
}

// 整卷每一页都已扫过才返回合计（仍是普通题口径，内联题不计）；缺任一页返回 null。
export function scanAllPagesSummary(acc, r) {
  const pages = Number(r && r.pages) || 0;
  const code = (r && r.code) || '';
  const e = acc && code ? acc[code] : null;
  if (pages <= 1 || !e) return null;
  const sum = { answered: 0, correct: 0, total: 0 };
  for (let p = 1; p <= pages; p++) {
    const s = e[p];
    if (!s) return null;
    sum.answered += s.answered;
    sum.correct += s.correct;
    sum.total += s.total;
  }
  return sum;
}

export function scanPagesNote(r, acc) {
  const page = Number(r && r.page) || 0;
  const pages = Number(r && r.pages) || 0;
  const total = Number(r && r.total) || 0;
  if (page <= 0 || pages <= 1 || total <= 0) return '';
  const all = scanAllPagesSummary(acc, r);
  if (all) return '本卷答题卡 ' + pages + ' 页已全部判分 · 合计已作答 ' + all.answered + '/' + all.total + ' · 答对 ' + all.correct + ' 题';
  const first = (r.items && r.items.length && Number(r.items[0].no)) || 0;
  const a = first > 0 ? first : 1;
  const b = a + total - 1;
  return '本卷答题卡共 ' + pages + ' 页，本页只判第 ' + a + '–' + b + ' 题；其余页请分别扫描';
}
