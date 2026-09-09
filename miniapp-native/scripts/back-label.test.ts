// R556：练习页「返回」文案按 navigateBack 实际落点给出（R555-2：H5 从错题本重练进来写「返回首页」却回了错题本）。
// 运行：cd miniapp-native && ../frontend-uni/node_modules/.bin/vitest run --config scripts/vitest.config.mts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { backLabel, prevRoute } from '../miniprogram/utils/back-label';
import { doneBarPlan } from '../miniprogram/utils/done-bar';

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

describe('backLabel', () => {
  it('栈 ≤1（分享/扫码直达）→ 返回首页（onQuit fail 分支 switchTab 首页）', () => {
    expect(backLabel(undefined)).toBe('返回首页');
    expect(backLabel([])).toBe('返回首页');
    expect(backLabel([{ route: 'pages/practice/practice' }])).toBe('返回首页');
  });
  it('上一页已知 → 返回<页名>；未知 → 返回', () => {
    expect(backLabel([{ route: 'pages/book/book' }, { route: 'pages/practice/practice' }])).toBe('返回错题本');
    expect(backLabel([{ route: 'pages/home/home' }, { route: 'pages/practice/practice' }])).toBe('返回首页');
    expect(backLabel([{ route: '/pkgExam/report/report?id=1' }, { route: 'pages/practice/practice' }])).toBe('返回成绩报告');
    expect(backLabel([{ route: 'pages/team/panel' }, { route: 'pages/practice/practice' }])).toBe('返回');
    expect(backLabel([{}, { route: 'pages/practice/practice' }])).toBe('返回');
  });
  it('prevRoute 取倒数第二页并归一前导斜杠/query', () => {
    expect(prevRoute([{ route: '/pages/book/book?kp=x' }, { route: 'pages/practice/practice' }])).toBe('pages/book/book');
    expect(prevRoute([{ route: 'pages/practice/practice' }])).toBe('');
  });
});

describe('doneBarPlan 第三参', () => {
  it('无错题时次级按钮用传入文案；有错题层级不变', () => {
    expect(doneBarPlan(0, false, '返回错题本').secondary).toBe('返回错题本');
    expect(doneBarPlan(0, false, '').secondary).toBe('返回');
    expect(doneBarPlan(2, false, '返回错题本').secondary).toBe('再来一组');
  });
});

describe('practice 页接线', () => {
  const ts = read('../miniprogram/pages/practice/practice.ts');
  const wxml = read('../miniprogram/pages/practice/practice.wxml');
  it('onLoad 按页面栈算 backLabel；结算态 doneBarPlan 传入；加载失败层 secondaryText 绑定', () => {
    expect(ts).toContain("import { backLabel } from '../../utils/back-label';");
    expect(ts).toContain('backLabel: backLabel(getCurrentPages()),');
    expect(ts).toContain('doneBar: doneBarPlan(wrongN, beiMode, this.data.backLabel),');
    expect(wxml).toContain('secondaryText="{{backLabel}}"');
    expect(wxml).not.toContain('secondaryText="返回"');
  });
});
