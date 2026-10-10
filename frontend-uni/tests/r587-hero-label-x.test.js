// R587：新访客首屏 hero 的一句价值「拍题 AI 讲解 · 错题按遗忘曲线复习 · 迷你模考」在 360 下压进右上角 ✕ 的图标里。
// 生产一手（13px，同字体 canvas measureText）：文案 266.8px；.kg-hero__top 在 360/375/390 宽 273/288/303，
// 而 .hero-x（44×44，right: 8px）从卡片右缘向内占 52px，其中 32px 压在内容列上、图标 glyph 从内容列右缘向内 18px；
// 文案右缘 302.8 vs 360 下 glyph 左缘 291 → 压 glyph 11.8px；375 下 glyph 清出 3.2px 但仍压热区 10.8px（点文案末字会把 hero 关掉）。
// 修法：.hero-wrap 里给 .kg-hero__top 预留 --sp-32 右内边距（结构上文案永远进不了 ✕ 热区，过长就折行而不是叠字），
// 文案收短为「拍题 AI 讲解 · 遗忘曲线复习 · 迷你模考」227.8px < 360 下可用 241px，三档单行。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rule, BOX40 } from './_w5-hit.js';

const h5 = readFileSync(new URL('../src/pages/home/home.vue', import.meta.url), 'utf8');
const css = h5.slice(h5.indexOf('<style'));

const LABEL_W = { old: 266.8, new: 227.8 };
const TOP_W = { 360: 273, 375: 288, 390: 303 };
const X_INTRUDE_HIT = 32; // .hero-x 热区压进内容列的宽度（52 - 卡片 padding 20）
const X_INTRUDE_ICON = 18; // 图标 glyph 左缘距内容列右缘

describe('R587 新访客 hero 文案不再压进右上角 ✕', () => {
  it('旧文案在 360 压 glyph、在 375 压热区（论证前提）', () => {
    expect(LABEL_W.old).toBeGreaterThan(TOP_W[360] - X_INTRUDE_ICON);
    expect(LABEL_W.old).toBeGreaterThan(TOP_W[375] - X_INTRUDE_HIT);
    expect(LABEL_W.old).toBeLessThan(TOP_W[390] - X_INTRUDE_HIT);
  });

  it('新文案在 360/375/390 预留 32px 后仍单行', () => {
    for (const w of [360, 375, 390]) expect(LABEL_W.new).toBeLessThan(TOP_W[w] - X_INTRUDE_HIT);
  });

  it('源锁：文案收短 + .hero-wrap 内 .kg-hero__top 预留右内边距 + ✕ 仍 44×44', () => {
    expect(h5).toContain('label="拍题 AI 讲解 · 遗忘曲线复习 · 迷你模考"');
    expect(h5).not.toContain('错题按遗忘曲线复习 · 迷你模考');
    expect(rule(css, '.hero-wrap :deep(.kg-hero__top)')).toMatch(/padding-right:\s*var\(--sp-32\)/);
    expect(rule(css, '.hero-x')).toMatch(BOX40);
    expect(rule(css, '.hero-x')).toMatch(/right:\s*var\(--sp-8\)/);
  });
});
