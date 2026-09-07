import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../src/pages/home/home.vue', import.meta.url)), 'utf8');
const tpl = src.slice(0, src.indexOf('<script'));
const style = src.slice(src.indexOf('<style'));
const line = (sel) => style.split('\n').find((l) => l.startsWith(`${sel} `));

// R447–R449 的问题面是「补练往期 ›」与全站同题文案同一行（文案回包变长 → 链接水平漂移 / 折行压住 hero 按钮 / 热区下伸进按钮）。
// W5 起链接独占一行 .hero-lnk-row，放在 .hero-ds 文案之下、hero 按钮由 kg-hero-card 承载，三种重叠面结构上不再存在。
describe('R447/R448 「补练往期 ›」不与全站同题文案争一行（源文件锁）', () => {
  it('「补练往期 ›」在 .hero-ds 文案之外、独占 .hero-lnk-row（flex 行），不再绝对定位贴右', () => {
    expect(tpl).toMatch(/<text v-if="dsMeta && dsDone" class="hero-ds">[^\n]*<\/text>\s*<text v-else class="hero-ds">[^\n]*<\/text>\s*<view class="hero-lnk-row">\s*<text class="hero-lnk" role="button" @click\.stop="openDailyArchive">补练往期 ›<\/text>/);
    expect(tpl).not.toMatch(/hero-ds-arc/);
    expect(line('.hero-lnk-row')).toMatch(/display:\s*flex/);
    expect(line('.hero-lnk')).not.toMatch(/position:\s*absolute|float:/);
  });
  it('.hero-ds 文案行自身不再需要定位父级 / 右侧预留', () => {
    const ds = line('.hero-ds');
    expect(ds).toBeTruthy();
    expect(ds).not.toMatch(/position:\s*relative|padding-right/);
  });
  it('链接热区 40px 用负外边距吸收（行高不变），不会下伸进下一行', () => {
    const lnk = line('.hero-lnk');
    expect(lnk).toMatch(/min-height:\s*40px/);
    expect(lnk).toMatch(/margin:\s*-3px 0/);
    // .hero-links 列向 gap 4px ≥ 负外边距外溢 3px
    expect(line('.hero-links')).toMatch(/flex-direction:\s*column;\s*gap:\s*var\(--sp-4\)/);
  });
});
