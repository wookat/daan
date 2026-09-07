import { describe, it, expect } from 'vitest';
import { read } from './_w5-hit.js';

// R509：生产练习页 Lighthouse a11y 0.96×3 的 color-contrast 失败项之一是禁用态主按钮「请选择答案」
// （白字 opacity .4 叠品牌色 = 1.29:1）。H5 的 <uni-button> 不是原生 button、wd-button 也不透传 disabled 属性，
// DOM 上只有 is-disabled 类 → 辅助技术把它当可用按钮，axe 也不按「禁用控件」跳过对比度。
// 修法在 kg-button 一处：disabled/loading 时显式 aria-disabled="true"，其它态不落属性。
describe('R509 kg-button 禁用/加载态显式 aria-disabled（源文件锁）', () => {
  const btn = read('components/kg-button/kg-button.vue');

  it('wd-button 根上 :aria-disabled 跟随 disabled || loading，可用态为 null（不落属性）', () => {
    expect(btn).toMatch(/<wd-button[\s\S]*?:aria-disabled="disabled \|\| loading \? 'true' : null"[\s\S]*?>/);
  });

  it('仍保留 :disabled 透传与 onClick 守卫（禁用/加载态不发 click）', () => {
    expect(btn).toMatch(/:disabled="disabled"/);
    expect(btn).toMatch(/onClick\(e\) \{\s*if \(this\.disabled \|\| this\.loading\) return;/);
  });

  it('练习页底栏禁用态仍走 kg-action-bar → kg-button :disabled（不自绘按钮）', () => {
    const bar = read('components/kg-action-bar/kg-action-bar.vue');
    expect((bar.match(/<kg-button[^>]*:disabled="disabled"/g) || []).length).toBeGreaterThanOrEqual(2);
    const practice = read('pages/practice/practice.vue');
    expect(practice).toMatch(/:disabled="barPrimary\.disabled"/);
    expect(practice).toMatch(/return \{ text: '请选择答案', disabled: true/);
  });
});
