// 复习单题作答判定文案（与 H5 review-summary.js reviewVerdict 同口径；WXML 不能调函数，在页面层算好下发）。
// `mastered` 来自服务端 /api/review/{mid} 回包：连对达阈值即移出复习计划，此时不再有「下次复习」。

export interface ReviewVerdictArgs {
  extra?: boolean;
  requeued?: boolean;
  wasCorrect: boolean;
  streak?: number;
  nextDays?: number;
  mastered?: boolean;
}

export function reviewVerdict(a: ReviewVerdictArgs): string {
  const streak = Number(a.streak) || 0;
  const nextDays = Number(a.nextDays) || 0;
  if (a.extra) return a.wasCorrect ? '答对了，这个考法稳了' : '还没稳，仔细看解析';
  if (a.wasCorrect && a.mastered === true) return '答对了！连对 ' + streak + ' 次 · 已掌握，移出复习计划';
  const head = a.wasCorrect
    ? a.requeued
      ? '这次答对了，本轮已纠正'
      : '答对了！连对 ' + streak + ' 次'
    : '又错了，看解析（稍后本轮会再出现）';
  return head + '（下次复习：' + nextDays + ' 天后）';
}
