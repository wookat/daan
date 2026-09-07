import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { read, styleOf, rule } from './_w5-hit.js';

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const walk = (d) =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.vue') ? [p] : [];
  });
const pages = walk(SRC).map((p) => [p.slice(SRC.length + 1), readFileSync(p, 'utf8')]);
const tpl = (src) => src.slice(0, src.indexOf('<script'));

// R471：全仓「加载失败 → 重试」文字链 ≥40px。W5 起失败态统一走 kg-empty-state（cta = kg-button lg/sm，
// 命中区在组件层 --hit-min），页面不再自绘 .retry。
const withRetryCta = pages.filter(([, s]) => /cta-text="重试"/.test(tpl(s)));

describe('R471 全仓「加载失败 → 重试」热区（源文件锁）', () => {
  it('不再有页面自绘 .retry 文字链；带「重试」CTA 的失败态 ≥14 页（漏扫即失败）', () => {
    expect(pages.filter(([, s]) => /class="[^"]*\bretry\b/.test(tpl(s))).map(([n]) => n)).toEqual([]);
    expect(withRetryCta.length).toBeGreaterThanOrEqual(14);
  });

  for (const [name, src] of withRetryCta) {
    it(`${name}：「重试」由 kg-empty-state 的 cta 承担（独占按钮行，不与错误文案同行）`, () => {
      const blocks = tpl(src).match(/<kg-empty-state[\s\S]*?\/>/g) || [];
      expect(blocks.some((b) => /cta-text="重试"/.test(b)), 'cta 在 kg-empty-state 内').toBe(true);
    });
  }

  it('kg-empty-state 的 cta 是 kg-button（lg=44 / sm 走 ::after 命中 44），按钮行与文案分行', () => {
    const empty = read('components/kg-empty-state/kg-empty-state.vue');
    expect(empty).toMatch(/<kg-button v-if="ctaText" variant="primary" :size="compact \? 'sm' : 'lg'" @click="go">\{\{ ctaText \}\}<\/kg-button>/);
    expect(rule(styleOf(empty), '.kg-empty__acts')).toMatch(/display:\s*flex/);
    const btn = read('components/kg-button/kg-button.vue');
    expect(btn).toMatch(/\.kg-btn\.kg-btn--sm::after, \.kg-btn\.kg-btn--md::after \{[^}]*height: var\(--hit-min\)/);
    expect(read('styles/tokens.generated.css')).toMatch(/--btn-h-lg:\s*44px;/);
  });

  it('首页专项练习骨架「点此重试」整块 .skelwrap 可点（不靠 12px 提示文字本体）', () => {
    const home = read('pages/home/home.vue');
    expect(home).toMatch(/<view v-if="!counts\.length" class="skelwrap" @click="loadCounts">\s*<kg-skeleton preset="cards" \/>\s*<text class="skel-hint">题库加载中…点此重试<\/text>/);
  });
});
