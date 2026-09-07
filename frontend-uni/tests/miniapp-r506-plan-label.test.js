import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { planDaysLabel, isExamDatePast, examDateFieldText } from '../../miniapp-native/miniprogram/utils/plan-label.ts';

const mp = (p) => readFileSync(fileURLToPath(new URL('../../miniapp-native/miniprogram/' + p, import.meta.url)), 'utf8');

// R506：小程序首页与 H5 R504/R505b 同形态——服务端 plan_today.days_left 对已过考试日期回负数、
// /api/profile 不拒绝已过日期；小程序此前把 daysLeft 原样渲染（两处）且表单只拦空日期。
describe('R506 小程序 plan-label：已过考试日期不显示「距考试 -1 天」，表单已过日期标出并拦截', () => {
  it('planDaysLabel：正数倒计时 / 0 今天考试 / 负数「考试日期已过」/ 非整数空', () => {
    expect(planDaysLabel(30, '基础期')).toBe('距考试 30 天\u3000基础期');
    expect(planDaysLabel(0, '冲刺期')).toBe('今天考试\u3000冲刺期');
    expect(planDaysLabel(-1, '冲刺期')).toBe('考试日期已过\u3000点「编辑计划」更新');
    expect(planDaysLabel(-1)).toBe('考试日期已过\u3000点「编辑计划」更新');
    expect(planDaysLabel(null)).toBe('');
    expect(planDaysLabel(undefined)).toBe('');
    expect(planDaysLabel(1.5)).toBe('');
  });
  it('isExamDatePast / examDateFieldText：字典序比东八区今天；空/非法不算已过', () => {
    expect(isExamDatePast('2026-09-07', '2026-09-08')).toBe(true);
    expect(isExamDatePast('2026-09-08', '2026-09-08')).toBe(false);
    expect(isExamDatePast('2027-03-20', '2026-09-08')).toBe(false);
    expect(isExamDatePast('', '2026-09-08')).toBe(false);
    expect(isExamDatePast('2026/09/07', '2026-09-08')).toBe(false);
    expect(examDateFieldText('', '2026-09-08')).toBe('选择日期');
    expect(examDateFieldText('2026-09-07', '2026-09-08')).toBe('2026-09-07 · 已过，请重选');
    expect(examDateFieldText('2027-03-20', '2026-09-08')).toBe('2027-03-20');
  });
  it('home.ts：daysText/daysTitle 走 planDaysLabel；第 1 步按 cnDayKey() 拦截已过日期；日期框状态随 pf.exam_date 同步', () => {
    const ts = mp('pages/home/home.ts');
    expect(ts).toMatch(/import \{ examDateFieldText, isExamDatePast, planDaysLabel \} from '\.\.\/\.\.\/utils\/plan-label';/);
    expect(ts).toMatch(/daysText: planDaysLabel\(plan\.days_left, plan\.phase_name \|\| ''\),\s*daysTitle: planDaysLabel\(plan\.days_left\),/);
    expect(ts).toMatch(/if \(setupStep === 1 && isExamDatePast\(pf\.exam_date, cnDayKey\(\)\)\) \{\s*this\.syncPfDate\(\);\s*wx\.showToast\(\{ title: '考试日期已过，请重新选择', icon: 'none' \}\);\s*return;/);
    expect(ts).toMatch(/onPfDate\(e: WechatMiniprogram\.PickerChange\) \{\s*this\.setData\(\{ 'pf\.exam_date': String\(e\.detail\.value\) \}\);\s*this\.syncPfDate\(\);/);
    expect(ts).toMatch(/onOpenSetup\(\) \{\s*this\.syncPfDate\(\);/);
    expect(ts).toMatch(/this\.setData\(\{ pf: \{ \.\.\.this\.data\.pf, \.\.\.profile \} \}\);\s*this\.syncPfDate\(\);/);
  });
  it('home.wxml：两处 daysLeft 直渲染已换为 daysText/daysTitle；日期框用 pfDateText + past 类', () => {
    const wxml = mp('pages/home/home.wxml');
    expect(wxml).not.toMatch(/'距考试 ' \+ daysLeft/);
    expect(wxml).toMatch(/desc="\{\{\(daysText \? daysText \+ '\u3000' : ''\) \+ '今日 ' \+ planDone \+ '\/' \+ planTotal\}\}"/);
    expect(wxml).toMatch(/<text class="sheet-t">学习计划\{\{daysTitle \? '\u3000' \+ daysTitle : ''\}\}<\/text>/);
    expect(wxml).toMatch(/class="pf-date \{\{pf\.exam_date \? '' : 'empty'\}\} \{\{pfDatePast \? 'past' : ''\}\}"/);
    expect(wxml).toMatch(/<text>\{\{pfDateText\}\}<\/text>/);
    const wxss = mp('pages/home/home.wxss');
    expect(wxss).toMatch(/\.pf-date\.past \{\s*color: var\(--bad-strong\);/);
  });
});
