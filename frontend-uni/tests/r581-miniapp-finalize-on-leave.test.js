// R581：小程序练习页与 H5 R580 finalizeIfAnswered 同口径——全部答完停在末题反馈态直接离页（onUnload）视同完成。
// 源码级核实（miniapp-native practice.ts）：末题作答后 onPick 只 saveSession，finish() 只挂 onNext/autoNext；
// 直接返回 → onUnload flushProgress 把 N/N 存进本机 + 远端快照、不 postPracticeResult → 下次进页弹「上次还有一组未做完（10/10 题）」。
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { allAnswered } from '../src/quit-summary.js';
import { allAnswered as mpAllAnswered } from '../../miniapp-native/miniprogram/utils/practice-progress.ts';

const q = (id, picked = '') => ({ id, stem: 's' + id, options: { A: 'a', B: 'b' }, answer: 'A', _picked: picked });
const mp = readFileSync(new URL('../../miniapp-native/miniprogram/pages/practice/practice.ts', import.meta.url), 'utf8');

describe('allAnswered 小程序与 H5 同结果', () => {
  it('空/非数组/部分已答 → false；全答完 → true；空洞元素 fail-closed', () => {
    const cases = [[], null, undefined, [q(1), q(2)], [q(1, 'A'), q(2)], [q(1, 'A'), q(2, 'B')], [q(1, 'A'), null]];
    for (const items of cases) expect(mpAllAnswered(items)).toBe(allAnswered(items));
    expect(mpAllAnswered([q(1, 'A'), q(2, 'B')])).toBe(true);
    expect(mpAllAnswered([q(1, 'A'), q(2)])).toBe(false);
    expect(mpAllAnswered([])).toBe(false);
  });
});

describe('practice.ts 接线（源锁）', () => {
  const unload = mp.slice(mp.indexOf('onUnload() {'), mp.indexOf('finalizeIfAnswered(): boolean {'));
  const finStart = mp.indexOf('finalizeIfAnswered(): boolean {');
  const fin = mp.slice(finStart, mp.indexOf('\n  },\n', finStart));

  it('onUnload 先 finalizeIfAnswered，命中则不再 flushProgress/补报（避免 N/N 快照回写与作答重复补报）', () => {
    expect(unload).toContain('if (!this.finalizeIfAnswered()) {');
    expect(unload).toContain('this.flushProgress();');
    expect(unload).toContain('this.logAttempts(this.data.items);');
    expect(unload.indexOf('this.finalizeIfAnswered()')).toBeLessThan(unload.indexOf('this.flushProgress()'));
  });

  it('finalizeIfAnswered 守卫：已结算/背题/已上报/未全答完 → false；命中后 _resultSent 先置位再发请求（幂等）', () => {
    expect(fin).toContain('if (finished || beiMode || this._resultSent || !allAnswered(items)) return false;');
    expect(fin.indexOf('this._resultSent = true;')).toBeLessThan(fin.indexOf('postPracticeResult('));
    expect(fin).toContain('wx.removeStorageSync(PENDING_KEY);');
    expect(fin).toContain('this.clearServerProgress();');
    expect(fin).toContain('this.logAttempts(items);');
    expect(fin).toContain("postPracticeResult(this._module || '', items.length, right, totalSecs).catch(() => {});");
    // 末题作答 1.5s 内离页：取消 debounce 的 flushProgress，避免清远端后又把 N/N 写回
    expect(fin).toContain('clearTimeout(this._progressTimer as ReturnType<typeof setTimeout>);');
    expect(fin).not.toContain('setData(');
  });

  it('flushProgress 已上报即不再写进度（onHide 晚到的 debounce 也不回写）', () => {
    expect(mp).toContain('if (this.data.finished || this._resultSent || this.data.offline || !this.data.items.length) return;');
  });

  it('finish() 结算路径仍走 _resultSent 幂等，不重复上报', () => {
    const finish = mp.slice(mp.indexOf('async finish() {'), mp.indexOf('// 结算态：只重练本组答错的题'));
    expect(finish).toContain('if (!this._resultSent) {');
  });
});
