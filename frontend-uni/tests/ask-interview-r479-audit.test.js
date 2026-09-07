import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { assertHitLayer, countTag, templateOf } from './_w5-hit.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const style = (src) => src.slice(src.indexOf('<style'));
const rule = (css, sel) => (css.match(new RegExp(`\\n\\s*${sel.replace(/[.:]/g, '\\$&')} \\{([^}]*)\\}`)) || [])[1] || '';
const srcs = {
  ask: read('../src/pages/ask/ask.vue'),
  interview: read('../src/pkgA/interview/interview.vue'),
  history: read('../src/pkgA/interview/history.vue'),
};
const pages = Object.fromEntries(Object.entries(srcs).map(([k, v]) => [k, style(v)]));

describe('R479 问答页 / 面试簇（出题 / 练习记录）字号下限与可点元素热区（源文件锁）', () => {
  for (const [name, css] of Object.entries(pages)) {
    it(`${name} 样式无 <24rpx（375 下 12px）字号`, () => {
      expect(css.match(/font-size:\s*(?:[1-9]|1\d|2[0-3])rpx/g) || []).toEqual([]);
    });
  }

  it('W5 组件层命中规则在位（sheet ✕ / sm·md 按钮 ::after / chip 44）', () => {
    assertHitLayer(expect);
  });

  it('问答页：三个 sheet（粘贴文字 / 确认图片 / 历史会话）走 kg-sheet，✕ 由组件 44 命中，页面不再自绘 .sheet-x', () => {
    expect(countTag(srcs.ask, 'kg-sheet')).toBe(3);
    expect(templateOf(srcs.ask)).not.toMatch(/class="sheet-x"/);
    expect(pages.ask).not.toMatch(/\.sheet-x\s*\{/);
  });

  it('问答页：解析评价「有用 / 有误」为 kg-button sm（组件 ::after 命中 44），父容器 flex 不改流', () => {
    expect(srcs.ask).toMatch(/<view v-if="!r\.rated" class="rate-btns">\s*<kg-button variant="ghost" size="sm" icon="thumbs-up" @click="rate\(r, true\)">有用<\/kg-button>\s*<kg-button variant="ghost" size="sm" tone="bad" icon="thumbs-down" @click="rate\(r, false\)">有误<\/kg-button>/);
    expect(rule(pages.ask, '.rate-btns')).toMatch(/display:\s*flex/);
  });

  it('问答页：页面自绘的可点元素保留 44（输入栏工具 / 答案 chip / 输入框），会话删除 / 追问 chips / 顶栏为 kg-button', () => {
    const css = pages.ask;
    expect(rule(css, '.ib-tool')).toMatch(/width:\s*var\(--hit-min\); height:\s*var\(--hit-min\)/);
    expect(rule(css, '.ans-chip')).toMatch(/min-height:\s*var\(--hit-min\)/);
    expect(rule(css, '.ib-inp')).toMatch(/height:\s*var\(--input-h\)/);
    expect(srcs.ask).toMatch(/<kg-button variant="text" size="sm" tone="bad" @click\.stop="delSession\(si\)">删除<\/kg-button>/);
    expect(srcs.ask).toMatch(/<view v-if="!r\.streaming" class="chips">\s*<kg-button variant="secondary" size="sm"/);
    expect(srcs.ask).toMatch(/<kg-button variant="secondary" size="lg" icon="rotate-ccw" aria-label="历史会话"/);
  });

  it('面试簇：分类行 wd-cell 可点整行、换一题 / 练习记录 / 按钮 / 记录页失败态重试均为 kg-button 或 kg-empty-state cta（组件命中 ≥44）', () => {
    expect(srcs.interview).toMatch(/<wd-cell\s+v-for="c in categories"[\s\S]*?is-link\s+clickable\s+@click="draw\(c\.name\)"/);
    expect(srcs.interview).toMatch(/<kg-button variant="text" size="sm" icon="shuffle" @click="draw\(pickedCategory, question\.id\)">换一题<\/kg-button>/);
    expect(srcs.interview).toMatch(/<kg-button variant="text" size="md" block icon="chevron-right" class="hist-link" @click="goHistory">练习记录<\/kg-button>/);
    expect(srcs.interview).toMatch(/<kg-button variant="ghost" size="lg" :disabled="streaming" @click="retry">重答本题<\/kg-button>/);
    expect(srcs.interview).toMatch(/<kg-button variant="primary" size="lg" class="grow" :disabled="streaming" @click="draw\(pickedCategory, question\.id\)">再练一题<\/kg-button>/);
    expect(srcs.history).toMatch(/<kg-empty-state[^>]*\n?[^>]*cta-text="重试"/);
    for (const p of ['interview', 'history']) expect(pages[p], p).not.toMatch(/\.(?:btn-primary|btn-ghost|retry|swap|cat)\s*\{/);
  });
});
