// R554：小程序练习结算态操作栏与 H5 practice.vue R553 完成页同层级——有错题时「只重练本组错题（N 题）」为主按钮、
// 「再来一组」降次级；无错题/背题模式维持「再来一组 / 返回」。此前小程序重练是卡内 secondary/md 小按钮、底栏主按钮仍是「再来一组」。
// 运行：cd miniapp-native && ../frontend-uni/node_modules/.bin/vitest run --config scripts/vitest.config.mts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { doneBarPlan } from '../miniprogram/utils/done-bar';

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

describe('doneBarPlan', () => {
  it('有错题：主按钮只重练本组错题（N 题）→ redo，次级再来一组 → retry', () => {
    expect(doneBarPlan(2, false)).toEqual({
      primary: '只重练本组错题（2 题）',
      primaryAct: 'redo',
      secondary: '再来一组',
      secondaryAct: 'retry',
    });
  });
  it('全对 / 背题模式 / 非法值：维持再来一组 → retry，返回 → quit', () => {
    const base = { primary: '再来一组', primaryAct: 'retry', secondary: '返回', secondaryAct: 'quit' };
    expect(doneBarPlan(0, false)).toEqual(base);
    expect(doneBarPlan(3, true)).toEqual(base);
    expect(doneBarPlan(undefined, false)).toEqual(base);
    expect(doneBarPlan(NaN, false)).toEqual(base);
  });
});

describe('practice 页接线', () => {
  const wxml = read('../miniprogram/pages/practice/practice.wxml');
  const ts = read('../miniprogram/pages/practice/practice.ts');
  it('底栏文案/动作来自 doneBar；卡内不再有独立的重练小按钮', () => {
    expect(wxml).toMatch(
      /<kg-action-bar wx:if="\{\{finished\}\}" layout="actions" primaryText="\{\{doneBar\.primary\}\}" secondaryText="\{\{doneBar\.secondary\}\}" bind:primary="onDonePrimary" bind:secondary="onDoneSecondary" \/>/
    );
    expect(wxml).not.toMatch(/bind:click="onRedoWrong"/);
    expect(wxml).not.toMatch(/primaryText="再来一组"/);
  });
  it('finish() 与 wrongCount 同源算 doneBar；primary/secondary 按 act 分派到 onRedoWrong/onRetry/onQuit', () => {
    expect(ts).toMatch(/const wrongN = items\.filter\(\(q\) => q\._picked && q\._picked !== q\.answer\)\.length;[\s\S]*?wrongCount: wrongN,\n\s+doneBar: doneBarPlan\(wrongN, beiMode\),/);
    expect(ts).toMatch(/runDoneAct\(act: DoneAct\) \{\n\s+if \(act === 'redo'\) this\.onRedoWrong\(\);\n\s+else if \(act === 'retry'\) this\.onRetry\(\);\n\s+else this\.onQuit\(\);/);
    expect(ts).toMatch(/onDonePrimary\(\) \{\n\s+this\.runDoneAct\(this\.data\.doneBar\.primaryAct\);/);
    expect(ts).toMatch(/onDoneSecondary\(\) \{\n\s+this\.runDoneAct\(this\.data\.doneBar\.secondaryAct\);/);
  });
});
