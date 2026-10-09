// R398 SOP-10：错题本（tab 页）所有底部弹层在 375 H5 下必须收在 TabBar（50px, z-index 998）上方；
// R396 走查实录：强化卡「下次再说」/ AI 失败文案 / 筛选 sheet 底行被 tabbar 完全遮住不可点。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../src/pages/book/book.vue', import.meta.url)), 'utf8')+readFileSync(fileURLToPath(new URL('../src/pages/book/review-ops.js', import.meta.url)), 'utf8');
const style = src.slice(src.indexOf('<style'));

describe('book.vue 弹层与 TabBar 关系（源文件锁）', () => {
  it('底部弹层统一走 KgSheet（层级读 --z-overlay 压过 TabBar 998），页面不再自绘 .mask 让位', () => {
    expect(src).toMatch(/<kg-sheet v-model="aiOpen"/);
    expect(src).toMatch(/<kg-sheet v-model="manualOpen"/);
    expect(style).not.toMatch(/\.mask \{/);
    const sheet = readFileSync(fileURLToPath(new URL('../src/components/kg-sheet/kg-sheet.vue', import.meta.url)), 'utf8');
    expect(sheet).toMatch(/--z-overlay/);
  });
  it('PDF 导出弹层显式 above-tabbar（组件级同一约定）', () => {
    expect(src).toMatch(/<export-confirm[\s\S]*?above-tabbar/);
  });
  it('AI 分析失败态：不缓存失败结果、给「重试」按钮', () => {
    expect(src).toMatch(/v-else-if="aiErr"[\s\S]*?@click="aiAnalysis\(true\)">重试</);
    expect(src).toMatch(/this\.aiErr = e\.message/);
    expect(src).not.toMatch(/this\.aiHtml = md\('分析失败/);
  });
});
