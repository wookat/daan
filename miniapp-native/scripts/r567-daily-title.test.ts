// R567：小程序每日一练/时政页顶栏标题与 H5 practiceNavTitle 同口径——往期补练时标题为「往期每日一练 / 往期时政补练」
// （此前 onLoad 只按 kind 定死，往期态仅靠 subTitle「往期补练 · 日期」+ toast）。普通/时政练习与 practice.ts 不同页，
// navTitleFor 不需要 daily 分支（R567 研究结论）。
// 运行：cd miniapp-native && ../frontend-uni/node_modules/.bin/vitest run --config scripts/vitest.config.mts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const DAILY = read('../miniprogram/pkgGrow/daily/daily.ts');
const WXML = read('../miniprogram/pkgGrow/daily/daily.wxml');

describe('pkgGrow/daily 顶栏标题', () => {
  it('onLoad 按 kind 初值；begin 按 past 四态与 H5 同文案', () => {
    expect(DAILY).toContain("this.setData({ kind, title: kind === 'shizheng' ? '时政每日一练' : '每日一练' });");
    const i = DAILY.indexOf('begin(items: DQ[], date: string, past: boolean) {');
    const body = DAILY.slice(i, DAILY.indexOf('this.startTimer();', i));
    expect(body).toContain("title: past ? (kind === 'shizheng' ? '往期时政补练' : '往期每日一练') : kind === 'shizheng' ? '时政每日一练' : '每日一练',");
    expect(body).toContain("subTitle: (past ? '往期补练 · ' : '') + date,");
  });
  it('navbar 绑 data.title', () => {
    expect(WXML).toContain('<navbar title="{{title}}" back />');
  });
});
