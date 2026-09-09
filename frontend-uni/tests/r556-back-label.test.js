// R556（R555-2）：practice.vue 退出按钮文案按 leave() 实际落点给出——页面栈 >1 时 navigateBack 回上一页
// （错题本重练进来 → 「返回错题本」），栈 1 页（深链直达）switchTab 首页 → 「返回首页」；此前三处硬编码「返回首页」。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { backLabel, prevRoute } from '../src/back-label.js';

const PRACTICE = readFileSync(fileURLToPath(new URL('../src/pages/practice/practice.vue', import.meta.url)), 'utf8');

describe('backLabel', () => {
  it('栈 ≤1 → 返回首页（与 leave() switchTab 首页一致）', () => {
    expect(backLabel(undefined)).toBe('返回首页');
    expect(backLabel([])).toBe('返回首页');
    expect(backLabel([{ route: 'pages/practice/practice' }])).toBe('返回首页');
  });
  it('上一页已知 → 返回<页名>；未知 → 返回', () => {
    const P = { route: 'pages/practice/practice' };
    expect(backLabel([{ route: 'pages/book/book' }, P])).toBe('返回错题本');
    expect(backLabel([{ route: 'pages/home/home' }, P])).toBe('返回首页');
    expect(backLabel([{ route: 'pages/stats/stats' }, P])).toBe('返回统计');
    expect(backLabel([{ route: 'pkgA/exam/list' }, P])).toBe('返回卷库');
    expect(backLabel([{ route: 'pkgA/exam/report' }, P])).toBe('返回成绩报告');
    expect(backLabel([{ route: 'pages/team/join' }, P])).toBe('返回');
    expect(backLabel([null, P])).toBe('返回');
  });
  it('兼容 $page.route / 前导斜杠 / query', () => {
    const P = { route: 'pages/practice/practice' };
    expect(backLabel([{ $page: { route: '/pages/book/book?kp=x' } }, P])).toBe('返回错题本');
    expect(prevRoute([{ route: '/pkgA/exam/report?id=3' }, P])).toBe('pkgA/exam/report');
    expect(prevRoute([P])).toBe('');
  });
});

describe('practice.vue 接线', () => {
  it('onShow 按页面栈算 backLabel，三处退出按钮绑定，不再硬编码「返回首页」', () => {
    expect(PRACTICE).toContain("import { backLabel } from '../../back-label.js';");
    expect(PRACTICE).toContain("      backLabel: '返回首页',");
    expect(PRACTICE).toMatch(/onShow\(\) \{\n\s+this\.askSeenTick\+\+;\n\s+this\.backLabel = backLabel\(getCurrentPages\(\)\);/);
    expect(PRACTICE).toContain(':secondary-text="backLabel"');
    expect((PRACTICE.match(/@click="quit">\{\{ backLabel \}\}<\/kg-button>/g) || []).length).toBe(2);
    expect(PRACTICE).not.toMatch(/>返回首页</);
    expect(PRACTICE).not.toContain('secondary-text="返回首页"');
  });
  it('leave() 落点逻辑不变：栈 >1 navigateBack（fail → 首页），否则 switchTab 首页', () => {
    expect(PRACTICE).toContain("if (getCurrentPages().length > 1) uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/home/home' }) });");
    expect(PRACTICE).toContain("else uni.switchTab({ url: '/pages/home/home' });");
  });
});
