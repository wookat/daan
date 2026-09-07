// 今日计划头部「距考试 N 天 · 阶段」文案：考试日期已过（days_left<0）不再倒计成负数，提示更新日期；
// 当天考试（0）说明「今天考试」；无日期（null/undefined/非数）→ ''（模板不渲染）
export function planDaysLabel(daysLeft, phaseName) {
  if (!Number.isInteger(daysLeft)) return '';
  const phase = phaseName ? ` · ${phaseName}` : '';
  if (daysLeft < 0) return '考试日期已过 · 点「编辑」更新';
  if (daysLeft === 0) return `今天考试${phase}`;
  return `距考试 ${daysLeft} 天${phase}`;
}
