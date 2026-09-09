// R565：练习完成页主出路改固定底栏（kg-action-bar actions），与小程序 utils/done-bar.ts doneBarPlan 同口径。
// 生产 375 全页截图（r560 b-complete-full-375）：主按钮「只重练本组错题（2 题）」位于页面 ~850/1050，首屏 667 之下需滚动才可见；
// 小程序结算态与 H5 模考报告都已是固定底栏，H5 练习完成页是唯一例外。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { doneBarPlan } from '../src/paper-continue.js';

const PRACTICE = readFileSync(new URL('../src/pages/practice/practice.vue', import.meta.url), 'utf8');

const W = { _picked: 'A', answer: 'B' };
const R = { _picked: 'B', answer: 'B' };

describe('doneBarPlan', () => {
  it('普通练习有错题：主「只重练本组错题（N 题）」redo，次「再来一组」retry', () => {
    expect(doneBarPlan([W, W, R], '', false, '返回首页')).toEqual({
      primary: '只重练本组错题（2 题）',
      primaryAct: 'redo',
      secondary: '再来一组',
      secondaryAct: 'retry',
    });
  });
  it('按卷有错题：主「重练本卷错题（N 题）」，次「回卷库」（非卷库来源 list；从卷库进来 quit 回上一页）', () => {
    expect(doneBarPlan([W, R], '2023 国考行测', false, '返回首页')).toEqual({
      primary: '重练本卷错题（1 题）',
      primaryAct: 'redo',
      secondary: '回卷库',
      secondaryAct: 'list',
    });
    expect(doneBarPlan([W, R], '2023 国考行测', false, '返回卷库')).toEqual({
      primary: '重练本卷错题（1 题）',
      primaryAct: 'redo',
      secondary: '回卷库',
      secondaryAct: 'quit',
    });
  });
  it('全对：主「再来一组」，次按实际落点文案 quit；按卷全对主「回卷库」', () => {
    expect(doneBarPlan([R, R], '', false, '返回错题本')).toEqual({ primary: '再来一组', primaryAct: 'retry', secondary: '返回错题本', secondaryAct: 'quit' });
    expect(doneBarPlan([R], '2023 国考行测', false, '返回首页')).toEqual({ primary: '回卷库', primaryAct: 'list', secondary: '返回首页', secondaryAct: 'quit' });
  });
  it('R566：从卷库进来的按卷全对不再同时给「回卷库」+「返回卷库」，只剩单键「回卷库」quit', () => {
    expect(doneBarPlan([R], '2023 国考行测', false, '返回卷库')).toEqual({ primary: '回卷库', primaryAct: 'quit', secondary: '', secondaryAct: 'quit' });
  });
  it('背题模式不出重练（即便有 _picked≠answer 的条目），主「再来一组」次「返回」', () => {
    expect(doneBarPlan([W, W], '', true, '返回首页')).toEqual({ primary: '再来一组', primaryAct: 'retry', secondary: '返回首页', secondaryAct: 'quit' });
  });
  it('fail-closed：back 非字符串/空 → 「返回」；items 非数组不抛', () => {
    expect(doneBarPlan([R], '', false, '').secondary).toBe('返回');
    expect(doneBarPlan([R], '', false, undefined).secondary).toBe('返回');
    expect(doneBarPlan(null, '', false, '返回首页')).toEqual({ primary: '再来一组', primaryAct: 'retry', secondary: '返回首页', secondaryAct: 'quit' });
  });
  it('与小程序 doneBarPlan 同口径（普通练习三态文案一致）', () => {
    const mini = readFileSync(new URL('../../miniapp-native/miniprogram/utils/done-bar.ts', import.meta.url), 'utf8');
    expect(mini).toContain("return { primary: `只重练本组错题（${n} 题）`, primaryAct: 'redo', secondary: '再来一组', secondaryAct: 'retry' };");
    expect(mini).toContain("return { primary: '再来一组', primaryAct: 'retry', secondary: back || '返回', secondaryAct: 'quit' };");
  });
});

describe('practice.vue 完成页接线', () => {
  it('结算段渲染 kg-action-bar actions，文案/动作全部来自 doneBar()（模板方法规避非响应式 _ptitle）', () => {
    const i = PRACTICE.indexOf('<!-- 结算段（T4） -->');
    const j = PRACTICE.indexOf('<!-- 答题卡 -->', i);
    const done = PRACTICE.slice(i, j);
    expect(done).toContain('<kg-action-bar\n          layout="actions"\n          class="done-bar"');
    expect(done).toContain(':primary-text="doneBar().primary"');
    expect(done).toContain(':secondary-text="doneBar().secondary"');
    expect(done).toContain('@primary="doneAct(doneBar().primaryAct)"');
    expect(done).toContain('@secondary="doneAct(doneBar().secondaryAct)"');
    expect(PRACTICE).toContain('doneBar() {\n      return doneBarPlan(this.items, this._ptitle, this.beiMode, this.backLabel);');
  });
  it('doneAct 四出路映射既有方法，未知动作回落 quit', () => {
    const i = PRACTICE.indexOf('    doneAct(act) {');
    const body = PRACTICE.slice(i, PRACTICE.indexOf('    },', i));
    expect(body).toContain("if (act === 'redo') this.retryWrong();");
    expect(body).toContain("else if (act === 'retry') this.retryGroup();");
    expect(body).toContain("else if (act === 'list') this.goExamList();");
    expect(body).toContain('else this.quit();');
  });
  it('行内 done-acts 只剩「分享成绩」+ 底栏没占到「返回」时的文字返回；页面 has-bar 覆盖结算态（底部留白不被底栏遮住）', () => {
    const i = PRACTICE.indexOf('<view class="done-acts">');
    const acts = PRACTICE.slice(i, PRACTICE.indexOf('</view>', i));
    expect(acts).toContain('@click="shareResult">分享成绩</kg-button>');
    expect(acts).toContain('<kg-button v-if="doneBar().secondaryAct !== \'quit\'" variant="text" size="md" block @click="quit">{{ backLabel }}</kg-button>');
    expect(acts).not.toContain('retryWrong');
    expect(acts).not.toContain('retryGroup');
    expect(PRACTICE).toContain('<view class="page" :class="{ \'has-bar\': session }">');
  });
  it('重练主位文案带题数时给主按钮更多宽度（375 两键并排不换行）', () => {
    expect(PRACTICE).toContain(':class="{ \'done-bar--long\': doneBar().primaryAct === \'redo\' }"');
    expect(PRACTICE).toContain('.done-bar.done-bar--long :deep(.kg-btn--primary) { flex: 1.7; }');
  });
});
