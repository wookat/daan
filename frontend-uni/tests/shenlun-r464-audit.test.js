import { describe, it, expect } from 'vitest';
import { read, styleOf, templateOf, rule, legacyHit, assertHitLayer } from './_w5-hit.js';

const src = read('pkgA/shenlun/shenlun.vue');
const style = styleOf(src);
const tpl = templateOf(src);

describe('R464 申论页字号下限 / 可点元素热区（源文件锁，W5 组件化后口径）', () => {
  it('样式块内无 <24rpx 字号（375 下 <12px）', () => {
    expect(style).not.toMatch(/font-size:\s*(?:1\d|2[0-3])rpx/);
  });

  it('组件层命中规则在位（kg-button / kg-sheet / kg-chip-row）', () => {
    assertHitLayer(expect);
  });

  it('页签 / 筛选 chip / 返回 / 上下题 / 复制链接 / 提交批改 已换成 kg-* 组件；旧页面级选择器不再挂模板', () => {
    expect(tpl).toMatch(/<kg-chip-row[^>]*:options="qtypeChips"/);
    expect(tpl).toMatch(/<kg-chip-row[^>]*:options="yearChips"/);
    expect(tpl).toMatch(/<kg-sheet v-model="fltOpen" title="筛选">/);
    expect(tpl).toMatch(/<kg-button variant="text" size="sm" icon="chevron-left" class="back" @click="detail = null">返回列表<\/kg-button>/);
    expect(tpl).toMatch(/<kg-button variant="ghost" size="md" icon="chevron-left"[^>]*aria-label="上一题"/);
    expect(tpl).toMatch(/<kg-button variant="ghost" size="md"[^>]*aria-label="下一题"/);
    expect(tpl).toMatch(/<kg-button variant="text" size="sm" icon="copy" aria-label="复制本题链接" @click="copyQLink">复制链接<\/kg-button>/);
    expect(tpl).toMatch(/<kg-button variant="primary" size="lg" block[^>]*class="grade-btn" @click="grade">/);
    for (const s of ['.seg-i', '.chip', '.q-go', '.d-nav-btn', '.d-copy', '.retry', '.sheet-x']) {
      expect(legacyHit(expect, src, s), s).toBe('componentized');
    }
    // .back / .grade-btn 只剩外边距，命中由 kg-button 组件层保证
    expect(rule(style, '.back')).not.toMatch(/min-height|height/);
    expect(rule(style, '.grade-btn')).not.toMatch(/min-height|height/);
  });

  it('自绘可点行「参考要点」折叠 min-height 走 --hit-min', () => {
    expect(tpl).toMatch(/<view class="d-toggle ref" role="button"/);
    expect(rule(style, '.d-toggle')).toMatch(/min-height:\s*var\(--hit-min\)/);
  });

  it('kg-tag 20px 视觉的两个可点标签（只看本套卷 / 清除套卷筛选）都挂 .tappable，用 ::after 撑 40px 命中区', () => {
    expect(tpl).toMatch(/<kg-tag v-if="q\.paper" tone="neutral" class="tappable" role="button"/);
    expect(tpl).toMatch(/<kg-tag v-if="paper" tone="brand" class="paper-tag tappable" role="button"/);
    expect(rule(style, '.tappable')).toMatch(/position:\s*relative/);
    const after = rule(style, '.tappable::after');
    expect(after).toMatch(/position:\s*absolute/);
    expect(after).toMatch(/height:\s*40px/);
    expect(after).toMatch(/top:\s*50%/);
    expect(after).toMatch(/translateY\(-50%\)/);
  });
});
