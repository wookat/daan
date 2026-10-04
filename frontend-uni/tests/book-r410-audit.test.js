// R410 SOP-10 一手审计（375×812 / 1440×900，rev c79a9a8）命中的可用性缺陷源文件锁：
// 375 列表见底时悬浮「＋」盖住末卡「···」；uni.showActionSheet 在 375 越过 TabBar、在 1440 被裁切；
// 错因/筛选 chip 24–26px、搜索清除 ✕ 24×16 低于 40px 热区。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assertHitLayer } from './_w5-hit.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const book = read('../src/pages/book/book.vue');
const practice = read('../src/pages/practice/practice.vue');
const style = book.slice(book.indexOf('<style'));
const rule = (src, cls) => (src.match(new RegExp(`\\n\\.${cls} \\{([^}]*)\\}`)) || [])[1] || '';
const tokens = read('../src/styles/tokens.generated.css');

describe('book.vue R410 审计修复（源文件锁）', () => {
  it('末卡「···」不被悬浮「＋」盖住：列表见底且非批量时渲染 .fabspace 占位（高度 ≥ FAB 104rpx + 底距 32rpx）', () => {
    expect(book).toMatch(/v-else-if="tab !== 'fav' && !batchMode && shownPage\.length" class="fabspace/);
    // FAB 52px + 底距 --sp-32（=32px）：与 R410 的 104rpx + 64rpx 在 375 下等值（84px）
    expect(rule(style, 'fabspace')).toMatch(/height:\s*calc\(52px \+ var\(--sp-32\)\)/);
    expect(tokens).toMatch(/--sp-32:\s*32px;/);
  });
  it('卡片「···」改为页内 .mask sheet（走 R398 让位 TabBar 规则），不再用 uni.showActionSheet', () => {
    expect(book).not.toMatch(/uni\.showActionSheet/);
    expect(book).toMatch(/<kg-sheet :model-value="!!moreSheet"[^>]*@update:model-value="\(v\) => \{ if \(!v\) moreSheet = null; \}"/);
    expect(book).toMatch(/this\.moreSheet = \{ m, acts \}/);
    expect(rule(style, 'more-act')).toMatch(/min-height:\s*48px/);
  });
  it('更多操作 sheet 提供错因自评四选一并 PATCH error_reason（此前列表页只能在复习答错后标注）', () => {
    expect(book).toMatch(/v-if="!moreSheet\.m\.mastered" class="reasons more-reasons"/);
    expect(book).toMatch(/<kg-chip-row size="sm" :options="REASONS\.map\(\(rz\) => \(\{ label: rz, value: rz \}\)\)" :model-value="moreSheet\.m\.error_reason \|\| ''"[^>]*@update:model-value="\(v\) => setItemReason\(moreSheet\.m, v\)"/);
    expect(book).toMatch(/setItemReason\(m, rz\)[\s\S]*?PATCH[\s\S]*?error_reason: next/);
  });
  it('错因 chip / 筛选 chip / 搜索清除 ✕ 热区 ≥ 40px，chip 字号 ≥ 24rpx（12px）', () => {
    assertHitLayer(expect);
    // 错题本错因 / 筛选 chip 已换 kg-chip-row（组件 ::after 命中 44）；练习页错因 chip 仍自绘
    expect(book).toMatch(/<kg-chip-row size="sm" :options="REASONS\.map/);
    expect(book.slice(0, book.indexOf('<script'))).not.toMatch(/class="rz"/);
    const rz = rule(practice.slice(practice.indexOf('<style')), 'rz');
    expect(rz).toMatch(/min-height:\s*40px/);
    expect(rz).toMatch(/font-size:\s*var\(--fs-sub\)/);
    expect(tokens).toMatch(/--fs-sub:\s*12px;/);
    const kp = rule(style, 'kpchip');
    expect(kp).toMatch(/min-height:\s*40px/);
    expect(rule(style, 'searchclear')).toMatch(/width:\s*var\(--hit-min\);\s*height:\s*var\(--hit-min\)/);
    // 纠错类型 chip → kg-chip-row；空态「去刷题」→ kg-empty-state cta（kg-button）
    expect(book).toMatch(/<kg-chip-row size="sm" :options="reportTypes\.map/);
    expect(book).toMatch(/title="待掌握已清零"[^>]*cta-text="去刷题"/);
  });
  it('已掌握 tab 空态有专属文案；批量条常驻「退出」', () => {
    expect(book).toMatch(/v-if="tab === 'done' && !kw && !hasFilter"[\s\S]*?还没有已掌握的错题/);
    expect(book).toMatch(/hasFilter\(\) \{\s*return !!\(this\.filterMod/);
    expect(book).toMatch(/aria-label="退出批量" @click="toggleBatch">退出</);
  });
});
