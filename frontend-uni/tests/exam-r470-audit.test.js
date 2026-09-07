import { describe, it, expect } from 'vitest';
import { read, styleOf, rule, legacyHit, assertHitLayer, countTag } from './_w5-hit.js';

// W5/main 起模考簇的失败态「重试」/ 弹层 ✕ / chip / 按钮全部走 kg-empty-state / kg-sheet / kg-chip-row / kg-button，
// 热区由组件层（--hit-min 44px）统一保证；页面级仍自绘的元素（卷头 / 记录行 / 答题卡题号格）按 token 锁 ≥40px。
const pages = {
  list: read('pkgA/exam/list.vue'),
  exam: read('pkgA/exam/exam.vue'),
  report: read('pkgA/exam/report.vue'),
  rankCard: read('components/rank-card/rank-card.vue'),
};

const CELL40 = /(?:min-)?width:\s*(?:var\(--acard-cell\)|4\dpx)[^}]*(?:min-)?height:\s*(?:var\(--acard-cell\)|4\dpx)/;

describe('R470 模考簇（卷库 / 考试 / 成绩报告 / 报告内排名卡组件）字号下限与可点元素热区（源文件锁）', () => {
  for (const [name, src] of Object.entries(pages)) {
    it(`${name} 样式无 <24rpx（375 下 12px）字号，也无 <12px 字面值`, () => {
      const css = styleOf(src);
      expect(css.match(/font-size:\s*(?:[1-9]|1\d|2[0-3])rpx/g) || []).toEqual([]);
      expect(css.match(/font-size:\s*(?:[1-9]|1[01])px/g) || []).toEqual([]);
    });
  }

  it('组件层热区契约（tokens / kg-button / kg-sheet / kg-chip-row / kg-section-header / kg-banner）', () => {
    assertHitLayer(expect);
    const tokens = read('styles/tokens.generated.css');
    expect(tokens).toMatch(/--acard-cell:\s*40px;/);
  });

  it('卷库页：失败态走 kg-empty-state、筛选走 kg-chip-row、弹层走 kg-sheet；卷头 / 记录行 ≥44px', () => {
    const src = pages.list;
    expect(countTag(src, 'kg-empty-state')).toBeGreaterThanOrEqual(1);
    expect(countTag(src, 'kg-chip-row')).toBeGreaterThanOrEqual(1);
    expect(countTag(src, 'kg-sheet')).toBeGreaterThanOrEqual(1);
    for (const sel of ['.retry', '.fchip', '.pbtn']) expect(legacyHit(expect, src, sel)).toBe('componentized');
    expect(rule(styleOf(src), '.paper-top')).toMatch(/min-height:\s*var\(--hit-min\)/);
    expect(rule(styleOf(src), '.arow')).toMatch(/min-height:\s*var\(--cell-h\)/);
  });

  it('考试页：答题卡走 kg-sheet（✕ 由组件撑 44px），题号格 40×40 token；选项走 kg-option-group', () => {
    const src = pages.exam;
    expect(countTag(src, 'kg-sheet')).toBeGreaterThanOrEqual(1);
    expect(countTag(src, 'kg-option-group')).toBe(1);
    expect(legacyHit(expect, src, '.sheet-x')).toBe('componentized');
    expect(rule(styleOf(src), '.acard-n')).toMatch(CELL40);
    for (const sel of ['.tbtn', '.opt', '.nbtn']) legacyHit(expect, src, sel, /min-height:\s*(?:44px|var\(--hit-min\)|var\(--btn-h-lg\))/);
  });

  it('报告页：题号格 40×40 token；弹层 ✕ / 错因 chip / 练同类题 / AI 详解 / 上下题 / 纠错 chip / 重试 走组件层', () => {
    const src = pages.report;
    expect(rule(styleOf(src), '.qn')).toMatch(CELL40);
    expect(countTag(src, 'kg-sheet')).toBeGreaterThanOrEqual(1);
    expect(countTag(src, 'kg-button')).toBeGreaterThanOrEqual(3);
    for (const sel of ['.sheet-x', '.drz', '.dreinf', '.dask', '.report-link', '.dnav-btn', '.dnav-mid', '.rp-chip', '.retry']) {
      legacyHit(expect, src, sel);
    }
    // R465 同类：min-height 用 rpx（44rpx = 22px）不是有效热区值
    expect(styleOf(src)).not.toMatch(/min-height:\s*\d+rpx/);
  });
});
