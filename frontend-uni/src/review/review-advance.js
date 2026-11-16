// /api/answer_log 返回的 reviewed（本次作答推进了复习计划的曾错题）→ 完成页统计/文案

export function reviewedMasteredCount(reviewed) {
  if (!Array.isArray(reviewed)) return 0;
  let n = 0;
  for (const r of reviewed) if (r && r.mastered === true) n++;
  return n;
}

// pendingSession 快照中的 reviewed（跨刷新/前进保住完成页「答对 n 道曾错题」计数）；按 mistake_id 去重，非法项丢弃
export function reviewedFromPending(saved) {
  const src = saved && Array.isArray(saved.reviewed) ? saved.reviewed : [];
  const seen = new Set();
  const out = [];
  for (const r of src) {
    if (!r || !Number.isInteger(r.mistake_id) || r.mistake_id <= 0 || seen.has(r.mistake_id)) continue;
    seen.add(r.mistake_id);
    out.push({ mistake_id: r.mistake_id, streak: Number.isInteger(r.streak) ? r.streak : 0, mastered: r.mastered === true });
  }
  return out;
}

export function fixReportText(rep) {
  if (!rep || !(rep.n > 0)) return '';
  let s = '本组答对 ' + rep.n + ' 道曾错题，复习计划已推进';
  if (rep.mastered > 0) s += '（' + rep.mastered + ' 道达成掌握）';
  return s;
}
