// /api/answer_log 返回的 reviewed（本次作答推进了复习计划的曾错题）→ 完成页统计/文案

export function reviewedMasteredCount(reviewed) {
  if (!Array.isArray(reviewed)) return 0;
  let n = 0;
  for (const r of reviewed) if (r && r.mastered === true) n++;
  return n;
}

export function fixReportText(rep) {
  if (!rep || !(rep.n > 0)) return '';
  let s = '本组答对 ' + rep.n + ' 道曾错题，复习计划已推进';
  if (rep.mastered > 0) s += '（' + rep.mastered + ' 道达成掌握）';
  return s;
}
