// 今日计划头部「距考试 N 天 · 阶段」文案：考试日期已过（days_left<0）不再倒计成负数，提示更新日期；
// 当天考试（0）说明「今天考试」；无日期（null/undefined/非数）→ ''（模板不渲染）
export function planDaysLabel(daysLeft, phaseName) {
  if (!Number.isInteger(daysLeft)) return '';
  const phase = phaseName ? ` · ${phaseName}` : '';
  if (daysLeft < 0) return '考试日期已过 · 点「编辑」更新';
  if (daysLeft === 0) return `今天考试${phase}`;
  return `距考试 ${daysLeft} 天${phase}`;
}

// 「今天」取东八区日期，与服务端 plan.days_left / cn_day_start 同口径（浏览器本地时区不影响判定）
export function cnTodayStr(nowMs = Date.now()) {
  return new Date(nowMs + 8 * 3600e3).toISOString().slice(0, 10);
}

// 计划表单里的考试日期是否已过（YYYY-MM-DD 字串按字典序比较；空/非法格式 → false 交给「请先选择」校验）
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isExamDatePast(dateStr, todayStr) {
  if (typeof dateStr !== 'string' || !DATE_RE.test(dateStr)) return false;
  if (typeof todayStr !== 'string' || !DATE_RE.test(todayStr)) return false;
  return dateStr < todayStr;
}

// 表单日期框文案：已过日期带「已过，请重选」提示，避免「编辑」后原样保存
export function examDateFieldText(dateStr, todayStr) {
  if (!dateStr) return '选择日期 ›';
  return isExamDatePast(dateStr, todayStr) ? `${dateStr} · 已过，请重选` : dateStr;
}

// 首页 `homePlanCard` 本地标记：有今日计划卡时存任务行数（下次冷启动骨架按同行数等高占位），否则存 ''（走引导卡/不占位）
export function planCardMark(planToday) {
  if (!planToday || !planToday.profile) return '';
  const n = Array.isArray(planToday.tasks) ? planToday.tasks.length : 0;
  return String(n || 1);
}
