// R519（R517-1）：纠错弹层 7 个类型 chip 在 KgChipRow 横滚行里 375 只全显 3 / 1440 全显 4，其余靠横向滚轮才够到；
// 组件加 wrap 开关：弹层内必选全集换行全显、不渐隐、不横滚；默认横滚契约（COMPONENTS §1.3）与其它消费者不变。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const CHIP = readFileSync(new URL('../src/components/kg-chip-row/kg-chip-row.vue', import.meta.url), 'utf8');
const BOOK = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8');

describe('KgChipRow wrap', () => {
  it('prop 默认 false；wrap 时关横滚 / 关 scroll-into-view / 去渐隐 / 行 flex-wrap', () => {
    expect(CHIP).toContain('wrap: { type: Boolean, default: false },');
    expect(CHIP).toContain(':scroll-x="!wrap"');
    expect(CHIP).toContain(':scroll-into-view="scrollToSelected && !wrap ? `kgchip-${String(modelValue)}` : \'\'"');
    expect(CHIP).toContain("{ 'kg-chips--wrap': wrap }");
    expect(CHIP).toMatch(/\.kg-chips--wrap \{ white-space: normal; -webkit-mask-image: none; mask-image: none; \}/);
    expect(CHIP).toMatch(/\.kg-chips--wrap \.kg-chips__row \{ display: flex; flex-wrap: wrap; padding-right: 0; \}/);
  });
  it('默认横滚契约不变：渐隐 mask + nowrap + inline-flex 行', () => {
    expect(CHIP).toMatch(/\.kg-chips \{[^\n]*white-space: nowrap;[^\n]*mask-image: linear-gradient\(90deg, #000 calc\(100% - 24px\), transparent\); \}/);
    expect(CHIP).toMatch(/\.kg-chips__row \{ display: inline-flex; gap: var\(--sp-8\);/);
  });
  it('book.vue 只有纠错弹层用 wrap；筛选/错因行仍横滚', () => {
    const rows = BOOK.match(/<kg-chip-row[^\n]*\/>/g) || [];
    expect(rows.length).toBeGreaterThan(1);
    const wrapped = rows.filter((r) => /\swrap\s/.test(r));
    expect(wrapped.length).toBe(1);
    expect(wrapped[0]).toContain('reportTypes.map');
  });
});
