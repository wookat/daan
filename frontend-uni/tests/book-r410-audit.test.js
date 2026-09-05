// R410 SOP-10 一手审计（375×812 / 1440×900，rev c79a9a8）命中的可用性缺陷源文件锁：
// 375 列表见底时悬浮「＋」盖住末卡「···」；uni.showActionSheet 在 375 越过 TabBar、在 1440 被裁切；
// 错因/筛选 chip 24–26px、搜索清除 ✕ 24×16 低于 40px 热区。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const book = read('../src/pages/book/book.vue');
const practice = read('../src/pages/practice/practice.vue');
const style = book.slice(book.indexOf('<style'));
const rule = (src, cls) => (src.match(new RegExp(`\\n\\.${cls} \\{([^}]*)\\}`)) || [])[1] || '';

describe('book.vue R410 审计修复（源文件锁）', () => {
  it('末卡「···」不被悬浮「＋」盖住：列表见底且非批量时渲染 .fabspace 占位（高度 ≥ FAB 104rpx + 底距 32rpx）', () => {
    expect(book).toMatch(/v-else-if="tab !== 'fav' && !batchMode && shownPage\.length" class="fabspace/);
    expect(rule(style, 'fabspace')).toMatch(/height:\s*calc\(104rpx \+ 64rpx\)/);
  });
  it('卡片「···」改为页内 .mask sheet（走 R398 让位 TabBar 规则），不再用 uni.showActionSheet', () => {
    expect(book).not.toMatch(/uni\.showActionSheet/);
    expect(book).toMatch(/v-if="moreSheet" class="mask"/);
    expect(book).toMatch(/this\.moreSheet = \{ m, acts \}/);
    expect(rule(style, 'more-act')).toMatch(/min-height:\s*48px/);
  });
  it('更多操作 sheet 提供错因自评四选一并 PATCH error_reason（此前列表页只能在复习答错后标注）', () => {
    expect(book).toMatch(/v-if="!moreSheet\.m\.mastered" class="reasons more-reasons"/);
    expect(book).toMatch(/setItemReason\(m, rz\)[\s\S]*?PATCH[\s\S]*?error_reason: next/);
  });
  it('错因 chip / 筛选 chip / 搜索清除 ✕ 热区 ≥ 40px，chip 字号 ≥ 26rpx（13px）', () => {
    for (const src of [style, practice.slice(practice.indexOf('<style'))]) {
      const rz = rule(src, 'rz');
      expect(rz).toMatch(/min-height:\s*40px/);
      expect(rz).toMatch(/font-size:\s*26rpx/);
    }
    const kp = rule(style, 'kpchip');
    expect(kp).toMatch(/min-height:\s*40px/);
    expect(kp).toMatch(/font-size:\s*26rpx/);
    expect(rule(style, 'searchclear')).toMatch(/min-width:\s*40px;\s*min-height:\s*40px/);
    expect(rule(style, 'rp-chip')).toMatch(/min-height:\s*40px/);
    expect(style).toMatch(/:deep\(\.e-btn2\) \{[^}]*min-height:\s*44px/);
  });
  it('已掌握 tab 空态有专属文案；批量条常驻「退出」', () => {
    expect(book).toMatch(/v-if="tab === 'done' && !kw && !hasFilter"[\s\S]*?还没有已掌握的错题/);
    expect(book).toMatch(/hasFilter\(\) \{\s*return !!\(this\.filterMod/);
    expect(book).toMatch(/aria-label="退出批量" @click="toggleBatch">退出</);
  });
});
