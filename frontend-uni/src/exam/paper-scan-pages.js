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

// 秒级时间戳 → 「今天 HH:MM」/「M月D日 HH:MM」；无效返回 fallback。
export function scanWhen(t, now = Date.now(), fallback = '此前') {
  const ts = Number(t) || 0;
  if (ts <= 0) return fallback;
  const d = new Date(ts * 1000);
  const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const today = new Date(now);
  const sameDay = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  return (sameDay ? '今天 ' : d.getMonth() + 1 + '月' + d.getDate() + '日 ') + hm;
}

// 后端对同 uid 同卷同页完全相同的作答只落库一次（dup=true, dup_at=首次时刻）：重扫同一张卡 / 重复交卷不再翻倍做题记录、不打回复习进度。
export function scanDupNote(r, now = Date.now()) {
  if (!r || !r.dup) return '';
  const what = Number(r.page) > 0 ? '这一页' : '这份答案';
  return what + '已于 ' + scanWhen(r.dup_at, now) + ' 判分并记入做题记录；本次答案完全相同，未重复记录，复习进度不受影响';
}

// 录入层：paper/{code}?uid= 回包 submitted_pages（该账号对该卷已判过分的记录：手动录入整卷 page 0、扫描答题卡 1..P）
// → 进层即知已判过，不必录完再被告知 dup。
export function paperSubmittedNote(p, now = Date.now()) {
  const sp = (p && Array.isArray(p.submitted_pages) && p.submitted_pages) || [];
  if (!sp.length) return '';
  const label = (e) => {
    const page = Number(e.page) || 0;
    const n = Number(e.n) || 0;
    return (page > 0 ? '答题卡第 ' + page + ' 页' : '手动录入') + ' ' + scanWhen(e.last_at || e.first_at, now) + (n > 1 ? '（' + n + ' 次不同作答）' : '');
  };
  return '这份卷你已判过分：' + sp.map(label).join(' · ') + '；再次交卷时作答完全相同不会重复记录，有改动会记为新的作答';
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
