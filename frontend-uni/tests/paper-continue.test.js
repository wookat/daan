// R360：按卷练习「只练剩余」——paperContinuePlan fail-closed 纯函数
import { describe, it, expect } from 'vitest';
import { paperContinuePlan, paperPracticedState } from '../src/paper-continue.js';

describe('paperContinuePlan', () => {
  it('非数组 fail-closed 空计划', () => {
    expect(paperContinuePlan(null)).toEqual({ doneN: 0, remaining: [] });
    expect(paperContinuePlan(undefined)).toEqual({ doneN: 0, remaining: [] });
    expect(paperContinuePlan({})).toEqual({ doneN: 0, remaining: [] });
  });

  it('无 done 标记（无 uid 契约）全部视为未练', () => {
    const items = [{ id: 1 }, { id: 2 }];
    const p = paperContinuePlan(items);
    expect(p.doneN).toBe(0);
    expect(p.remaining).toEqual(items);
  });

  it('done:true 计入已练并从剩余中剔除，顺序保持', () => {
    const items = [{ id: 1, done: true }, { id: 2, done: false }, { id: 3, done: true }, { id: 4 }];
    const p = paperContinuePlan(items);
    expect(p.doneN).toBe(2);
    expect(p.remaining.map((q) => q.id)).toEqual([2, 4]);
  });

  it('非布尔 done 值 fail-closed 视为未练', () => {
    const items = [{ id: 1, done: 1 }, { id: 2, done: 'true' }, null];
    const p = paperContinuePlan(items);
    expect(p.doneN).toBe(0);
    expect(p.remaining.length).toBe(3);
  });

  it('全部已练：剩余为空（调用侧不弹窗、从头练）', () => {
    const items = [{ id: 1, done: true }, { id: 2, done: true }];
    const p = paperContinuePlan(items);
    expect(p.doneN).toBe(2);
    expect(p.remaining).toEqual([]);
  });
});

// R361：卷卡按卷练习完成态——paperPracticedState fail-closed 纯函数
describe('paperPracticedState', () => {
  it('非法输入 fail-closed 不显示', () => {
    expect(paperPracticedState(null, 75)).toEqual({ show: false, done: false, text: '' });
    expect(paperPracticedState('3', 75).show).toBe(false);
    expect(paperPracticedState(3.5, 75).show).toBe(false);
    expect(paperPracticedState(3, null).show).toBe(false);
    expect(paperPracticedState(3, 0).show).toBe(false);
    expect(paperPracticedState(3, -1).show).toBe(false);
  });

  it('零练过不显示', () => {
    expect(paperPracticedState(0, 75).show).toBe(false);
    expect(paperPracticedState(-2, 75).show).toBe(false);
  });

  it('部分完成显示进度文案', () => {
    expect(paperPracticedState(3, 75)).toEqual({ show: true, done: false, text: '已练 3/75 题' });
  });

  it('全练完（含超出）显示完成态', () => {
    expect(paperPracticedState(75, 75)).toEqual({ show: true, done: true, text: '已练完全部 75 题 ✓' });
    expect(paperPracticedState(80, 75).done).toBe(true);
  });
});
