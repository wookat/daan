import { describe, it, expect } from 'vitest';
import { read, styleOf, templateOf, rule, legacyHit, assertHitLayer } from './_w5-hit.js';

const srcs = {
  search: read('pkgA/search/search.vue'),
  discuss: read('pkgA/social/discuss.vue'),
  profile: read('pages/profile/profile.vue'),
  interview: read('pkgA/interview/interview.vue'),
};
const app = styleOf(read('App.vue'));

describe('R466 搜索 / 讨论 / 个人 / 面试页字号下限与可点元素热区（源文件锁，W5 组件化后口径）', () => {
  for (const [name, src] of Object.entries(srcs)) {
    it(`${name} 样式无 <24rpx（375 下 12px）字号`, () => {
      expect(styleOf(src).match(/font-size:\s*(?:[1-9]|1\d|2[0-3])rpx/g) || []).toEqual([]);
    });
  }

  it('组件层命中规则在位', () => {
    assertHitLayer(expect);
  });

  it('搜索页：范围页签 kg-chip-row / 清空历史 · AI 详解 · 复制链接 kg-button；wd-search 取消 / 清空 ✕ 由 App 级 ::after 扩到 --hit-min；历史 chip 自绘 40px + 省略', () => {
    const src = srcs.search;
    const tpl = templateOf(src);
    const css = styleOf(src);
    expect(tpl).toMatch(/<kg-chip-row :model-value="tab" :options="tabChips" size="sm" class="tabs" @update:model-value="onTab" \/>/);
    expect(tpl).toMatch(/<wd-search[\s\S]*?cancel-txt="取消"/);
    expect(tpl).toMatch(/<kg-button variant="text" size="sm" icon="trash-2" class="hist-clear" @click="clearHist">清空历史<\/kg-button>/);
    expect(tpl).toMatch(/<kg-button variant="secondary" size="sm" icon="sparkles" @click\.stop="askFromSearch\(detail\)">AI 详解本题<\/kg-button>/);
    for (const s of ['.tab', '.scancel', '.sclear', '.d-copy', '.retry']) {
      expect(legacyHit(expect, src, s), s).toBe('componentized');
    }
    expect(rule(css, '.hist-clear')).not.toMatch(/min-height|height/);
    expect(rule(css, '.hist-chip')).toMatch(/min-height:\s*40px/);
    expect(rule(css, '.hist-chip')).toMatch(/max-width:\s*100%/);
    expect(rule(css, '.hist-chip-t')).toMatch(/text-overflow:\s*ellipsis/);
    // wot 的 wd-search__cancel 高 30 / __clear 约 28（无高度变量）：App.vue 全局 ::after 扩命中
    expect(rule(app, '.wd-search__cancel')).toMatch(/position:\s*relative/);
    expect(app).toMatch(/\.wd-search__cancel::after,\s*\.wd-search__clear::after \{[^}]*position:\s*absolute[^}]*height:\s*var\(--hit-min\)[^}]*translateY\(-50%\)/);
  });

  it('讨论页：消息 / 赞 / 回复·举报·删除 走 --hit-min，取消回复 ✕ 44×40 负外边距；发布 / 去广场 / 重试 是 kg-button lg / kg-empty-state CTA', () => {
    const src = srcs.discuss;
    const tpl = templateOf(src);
    const css = styleOf(src);
    expect(tpl).toMatch(/<view class="msg" role="button" aria-label="消息" @click="goInbox">/);
    expect(tpl).toMatch(/<view class="op up" :class="\{ on: c\.liked \}" role="button" aria-label="点赞"/);
    expect(tpl).toMatch(/<view class="rx" role="button" aria-label="取消回复"/);
    expect(tpl).toMatch(/<kg-button variant="primary" size="lg" icon="send"[^>]*@click="submit">发布<\/kg-button>/);
    expect(rule(css, '.msg')).toMatch(/min-height:\s*var\(--hit-min\)/);
    expect(rule(css, '.op')).toMatch(/min-height:\s*var\(--hit-min\)/);
    expect(rule(css, '.op')).toMatch(/margin-left:\s*calc\(-1 \* var\(--sp-8\)\)/);
    expect(rule(css, '.rx')).toMatch(/width:\s*var\(--hit-min\)/);
    expect(rule(css, '.rx')).toMatch(/height:\s*40px/);
    expect(rule(css, '.rx')).toMatch(/margin:\s*-6px 0/);
    // .up.on / .op.sm 只改色与字号，不再单独定义高度
    expect(rule(css, '.up.on')).not.toMatch(/min-height/);
    expect(rule(css, '.op.sm')).not.toMatch(/min-height/);
    for (const s of ['.chip', '.send', '.plaza-btn', '.retry']) {
      expect(legacyHit(expect, src, s), s).toBe('componentized');
    }
  });

  it('个人页：Zalize 产品 / 隐私 / 条款链接收进「关于」弹层，about-item 整行 --hit-min 命中', () => {
    const src = srcs.profile;
    const css = styleOf(src);
    expect(templateOf(src)).toMatch(/v-for="p in zlProducts"[\s\S]*?class="about-item"/);
    expect(templateOf(src)).toContain('隐私政策');
    expect(templateOf(src)).toContain('服务条款');
    expect(rule(css, '.about-item')).toMatch(/min-height:\s*var\(--hit-min\)/);
  });

  it('面试页：练习记录 › / 换一题 是 kg-button（md block / sm），旧 .swap 不再挂模板', () => {
    const src = srcs.interview;
    const tpl = templateOf(src);
    expect(tpl).toMatch(/<kg-button variant="text" size="md" block icon="chevron-right" class="hist-link" @click="goHistory">练习记录<\/kg-button>/);
    expect(tpl).toMatch(/<kg-button variant="text" size="sm" icon="shuffle" @click="draw\(pickedCategory, question\.id\)">换一题<\/kg-button>/);
    expect(legacyHit(expect, src, '.swap')).toBe('componentized');
    expect(rule(styleOf(src), '.hist-link')).not.toMatch(/min-height|height/);
  });
});
