// R552 复验（375 强化跳转）抓到 uni-h5 运行时 warn「showLoading 与 hideLoading 必须配对使用」：
// startReinforce 在 try 内先 showToast（toast 顶掉 loading）再 finally hideLoading → 无 loading 可隐藏。
// 修为：回包后立即 hideLoading，再出 toast；catch 分支同样先 hide 再 toast；finally 只复位 _starting。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PRACTICE = readFileSync(fileURLToPath(new URL('../src/pages/practice/practice.vue', import.meta.url)), 'utf8')+readFileSync(fileURLToPath(new URL('../src/practice/daily-ops.js', import.meta.url)), 'utf8')+readFileSync(fileURLToPath(new URL('../src/practice/session-ops.js', import.meta.url)), 'utf8');

describe('R552-fix practice.vue startReinforce loading/toast 配对', () => {
  it('hideLoading 在任何 showToast 之前，finally 不再 hideLoading', () => {
    const i = PRACTICE.indexOf('async startReinforce(launch) {');
    expect(i).toBeGreaterThan(0);
    const fn = PRACTICE.slice(i, PRACTICE.indexOf('    loginNudgeGo() {', i));
    expect(fn).toContain("uni.showLoading({ title: '组题中…', mask: true });");
    const hide = fn.indexOf('const d = await request(q);\n        uni.hideLoading();');
    expect(hide).toBeGreaterThan(0);
    expect(hide).toBeLessThan(fn.indexOf('uni.showToast('));
    expect(fn).toContain("} catch (e) {\n        uni.hideLoading();\n        uni.showToast({ title: '组题失败：' + e.message, icon: 'none' });");
    expect(fn).toContain('} finally {\n        this._starting = false;\n      }');
    expect((fn.match(/uni\.hideLoading\(\)/g) || []).length).toBe(2);
  });
});
