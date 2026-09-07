// R504：今日计划头「距考试 N 天」在考试日期已过后不再显示负数（生产 umst3 exam_date=09-07 → 09-08 显示「距考试 -1 天 · 冲刺期」）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { planDaysLabel } from '../src/plan-days-label.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

describe('planDaysLabel', () => {
  it('未来日期：距考试 N 天 · 阶段', () => {
    expect(planDaysLabel(83, '基础期')).toBe('距考试 83 天 · 基础期');
    expect(planDaysLabel(1, '冲刺期')).toBe('距考试 1 天 · 冲刺期');
  });

  it('考试日期已过（负数）：不显示负倒计时，提示更新日期', () => {
    expect(planDaysLabel(-1, '冲刺期')).toBe('考试日期已过 · 点「编辑」更新');
    expect(planDaysLabel(-40, '冲刺期')).toBe('考试日期已过 · 点「编辑」更新');
  });

  it('当天：今天考试 · 阶段', () => {
    expect(planDaysLabel(0, '冲刺期')).toBe('今天考试 · 冲刺期');
  });

  it('无阶段名不带分隔；null/undefined/非整数 → 空串不渲染', () => {
    expect(planDaysLabel(5, '')).toBe('距考试 5 天');
    expect(planDaysLabel(null, '冲刺期')).toBe('');
    expect(planDaysLabel(undefined, '冲刺期')).toBe('');
    expect(planDaysLabel('3', '冲刺期')).toBe('');
    expect(planDaysLabel(NaN, '冲刺期')).toBe('');
  });
});

describe('home.vue 今日计划头走 planDaysLabel（源锁）', () => {
  const src = read('../src/pages/home/home.vue');

  it('模板不再直接拼 days_left', () => {
    expect(src).not.toMatch(/距考试 \{\{ planToday\.days_left \}\}/);
    expect(src).toMatch(/<text v-if="planDaysText" class="plan-days">\{\{ planDaysText \}\}<\/text>/);
  });

  it('computed planDaysText 调 planDaysLabel(days_left, phase_name)', () => {
    expect(src).toMatch(/import \{ planDaysLabel[^}]*\} from '\.\.\/\.\.\/plan-days-label\.js'/);
    expect(src).toMatch(/planDaysText\(\) \{\s*return this\.planToday \? planDaysLabel\(this\.planToday\.days_left, this\.planToday\.phase_name\) : '';/);
  });
});
