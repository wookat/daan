// R505：首页「编辑」→ 制定学习计划 sheet 对已过考试日期原样放行（生产 umst3 exam_date=09-07、09-08 打开表单：
// 第 1 步显示「2026-09-07」无提示、下一步放行、第 3 步摘要仍带旧日期 → 生成会把已过日期原样 POST 回去，
// 计划头「考试日期已过 · 点「编辑」更新」形成闭环死路）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isExamDatePast, examDateFieldText, cnTodayStr } from '../src/plan-days-label.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

describe('isExamDatePast', () => {
  it('昨天/更早 → true；今天/未来 → false', () => {
    expect(isExamDatePast('2026-09-07', '2026-09-08')).toBe(true);
    expect(isExamDatePast('2025-12-31', '2026-09-08')).toBe(true);
    expect(isExamDatePast('2026-09-08', '2026-09-08')).toBe(false);
    expect(isExamDatePast('2026-11-29', '2026-09-08')).toBe(false);
  });

  it('空/非法格式/非字串 → false（交给「请先选择考试日期」校验）', () => {
    expect(isExamDatePast('', '2026-09-08')).toBe(false);
    expect(isExamDatePast(null, '2026-09-08')).toBe(false);
    expect(isExamDatePast(undefined, '2026-09-08')).toBe(false);
    expect(isExamDatePast('2026/09/07', '2026-09-08')).toBe(false);
    expect(isExamDatePast('2026-09-07', '')).toBe(false);
    expect(isExamDatePast('2026-09-07', undefined)).toBe(false);
  });
});

describe('cnTodayStr', () => {
  it('东八区日期：UTC 09-07 17:20 → CN 09-08（与服务端 days_left 同口径；浏览器 UTC 时仍判已过）', () => {
    expect(cnTodayStr(Date.UTC(2026, 8, 7, 17, 20))).toBe('2026-09-08');
    expect(cnTodayStr(Date.UTC(2026, 8, 7, 15, 59))).toBe('2026-09-07');
    expect(cnTodayStr(Date.UTC(2026, 8, 7, 16, 0))).toBe('2026-09-08');
    expect(isExamDatePast('2026-09-07', cnTodayStr(Date.UTC(2026, 8, 7, 17, 20)))).toBe(true);
  });
});

describe('examDateFieldText', () => {
  it('无日期 → 占位；未来日期 → 原样；已过 → 带「已过，请重选」', () => {
    expect(examDateFieldText('', '2026-09-08')).toBe('选择日期 ›');
    expect(examDateFieldText(null, '2026-09-08')).toBe('选择日期 ›');
    expect(examDateFieldText('2026-11-29', '2026-09-08')).toBe('2026-11-29');
    expect(examDateFieldText('2026-09-08', '2026-09-08')).toBe('2026-09-08');
    expect(examDateFieldText('2026-09-07', '2026-09-08')).toBe('2026-09-07 · 已过，请重选');
  });
});

describe('home.vue 计划表单接线（源锁）', () => {
  const src = read('../src/pages/home/home.vue');

  it('日期框走 pfDateText / past class，不再直接渲染 pf.exam_date', () => {
    expect(src).toMatch(/class="pf-date" :class="\{ empty: !pf\.exam_date, past: pfDatePast \}">\{\{ pfDateText \}\}/);
    expect(src).not.toMatch(/\{\{ pf\.exam_date \|\| '选择日期 ›' \}\}/);
    expect(src).toMatch(/\.pf-date\.past \{[^}]*var\(--bad-strong\)/);
  });

  it('setupNext 第 1 步：已过日期不放行并提示重选', () => {
    expect(src).toMatch(/if \(this\.setupStep === 1 && this\.pfDatePast\) \{\s*uni\.showToast\(\{ title: '考试日期已过，请重新选择'/);
  });

  it('pfDatePast / pfDateText 以东八区日期 cnTodayStr() 为「今天」，不用浏览器本地日期', () => {
    expect(src).toMatch(/pfDatePast\(\) \{\s*return isExamDatePast\(this\.pf\.exam_date, cnTodayStr\(\)\);/);
    expect(src).toMatch(/pfDateText\(\) \{\s*return examDateFieldText\(this\.pf\.exam_date, cnTodayStr\(\)\);/);
    expect(src).not.toMatch(/isExamDatePast\(this\.pf\.exam_date, this\.fmtDateStr/);
  });
});
