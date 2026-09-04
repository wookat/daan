// 按卷练习续练：按服务端逐题 done 标记拆分已练/未练，fail-closed（无标记视为未练）
export function paperContinuePlan(items) {
  if (!Array.isArray(items)) return { doneN: 0, remaining: [] };
  let doneN = 0;
  const remaining = [];
  for (const q of items) {
    if (q && q.done === true) doneN++;
    else remaining.push(q);
  }
  return { doneN, remaining };
}

// 按卷练习请求 query：src 必带；pid 仅正整数才带（卷面题集对齐卷卡口径）；uid 仅不计时带
export function paperQuery(p, untimed, uid) {
  let q = 'src=' + encodeURIComponent((p && p.source) || '');
  if (p && Number.isInteger(p.pid) && p.pid > 0) q += '&pid=' + p.pid;
  if (untimed && uid) q += '&uid=' + encodeURIComponent(uid);
  return q;
}

// 卷卡按卷练习进度外显：全练完给完成态，fail-closed（非法输入不显示）
export function paperPracticedState(practiced, n) {
  const p = Number.isInteger(practiced) ? practiced : 0;
  const total = Number.isInteger(n) ? n : 0;
  if (total <= 0 || p <= 0) return { show: false, done: false, text: '' };
  if (p >= total) return { show: true, done: true, text: `已练完全部 ${total} 题 ✓` };
  return { show: true, done: false, text: `已练 ${p}/${total} 题` };
}

// 按卷练习完成页归卷：有卷名走本卷完成态，fail-closed（非字符串/空串走通用完成态）
export function paperFinishState(ptitle) {
  if (typeof ptitle === 'string' && ptitle.trim()) {
    return { isPaper: true, big: '本卷练完', title: ptitle.trim() };
  }
  return { isPaper: false, big: '本组完成', title: '' };
}
