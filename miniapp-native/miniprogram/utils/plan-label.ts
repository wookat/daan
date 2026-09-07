// 学习计划文案（与 H5 plan-days-label.js 同口径）：
// 服务端 plan_today.days_left 对已过考试日期回负数，不能原样渲染成「距考试 -1 天」；
// 表单里的已过日期要显式标出并拦截「下一步」，否则「编辑计划」会把已过日期原样存回。

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 计划行/计划 sheet 的倒计时文案；非整数（未加载/无日期）返回空 */
export function planDaysLabel(daysLeft: number | null | undefined, phaseName?: string, sep = '　'): string {
  if (typeof daysLeft !== 'number' || !Number.isInteger(daysLeft)) return '';
  const phase = phaseName ? sep + phaseName : '';
  if (daysLeft < 0) return '考试日期已过' + sep + '点「编辑计划」更新';
  if (daysLeft === 0) return '今天考试' + phase;
  return '距考试 ' + daysLeft + ' 天' + phase;
}

/** YYYY-MM-DD 字典序比较；空/非法日期不算已过（交给「请先选择考试日期」） */
export function isExamDatePast(dateStr: string | null | undefined, todayStr: string): boolean {
  if (typeof dateStr !== 'string' || !DATE_RE.test(dateStr)) return false;
  if (!DATE_RE.test(todayStr)) return false;
  return dateStr < todayStr;
}

export function examDateFieldText(dateStr: string | null | undefined, todayStr: string): string {
  if (!dateStr) return '选择日期';
  return isExamDatePast(dateStr, todayStr) ? dateStr + ' · 已过，请重选' : dateStr;
}
