import { describe, it, expect } from 'vitest';
import { read, styleOf, templateOf, rule, legacyHit, assertHitLayer } from './_w5-hit.js';

// R481：R410 后从未整页过审的剩余页面。W5 起这些页的按钮/CTA/✕ 全部换成 kg-button / kg-empty-state / kg-sheet，
// 命中区在组件层；页面自留的可点元素与 wot 分段控件另锁。
const files = {
  offline: 'pkgA/user/offline.vue',
  plaza: 'pkgA/social/plaza.vue',
  poster: 'pkgA/social/poster.vue',
  inbox: 'pkgA/social/inbox.vue',
  join: 'pages/team/join.vue',
  login: 'pkgA/user/login.vue',
  exportConfirm: 'components/export-confirm/export-confirm.vue',
};
const pages = Object.fromEntries(Object.entries(files).map(([k, p]) => [k, read(p)]));
const app = read('App.vue');

describe('R481 R410 后从未整页过审的剩余页面：字号下限与可点元素热区（源文件锁）', () => {
  for (const [name, src] of Object.entries(pages)) {
    it(`${name} 样式无 <24rpx（375 下 12px）字号`, () => {
      expect(styleOf(src).match(/font-size:\s*(?:[1-9]|1\d|2[0-3])rpx/g) || []).toEqual([]);
    });
  }

  it('组件层命中规则（tokens / kg-button / kg-sheet / kg-chip-row / kg-section-header / kg-banner）', () => assertHitLayer(expect));

  it('导出弹层（卷库 / 首页 / 错题本共用）✕ 命中 ≥40px，负外边距不抬 sheet 头行', () => {
    const css = styleOf(pages.exportConfirm);
    expect(templateOf(pages.exportConfirm)).toMatch(/<view class="sheet-x" @click="\$emit\('close'\)">✕<\/view>/);
    expect(rule(css, '.sheet-x')).toMatch(/min-height:\s*40px/);
    expect(rule(css, '.sheet-x')).toMatch(/min-width:\s*40px/);
    expect(rule(css, '.sheet-x')).toMatch(/margin:\s*-6px/);
  });

  it('离线题包页：每行「下载 / 更新 / 删除」是 kg-button sm（组件 ::after 扩到 44）', () => {
    const tpl = templateOf(pages.offline);
    expect(tpl).toMatch(/<kg-button variant="secondary" size="sm" icon="rotate-ccw" @click="download\(m\.module\)">更新<\/kg-button>/);
    expect(tpl).toMatch(/<kg-button variant="text" size="sm" tone="bad" @click="remove\(m\.module\)">删除<\/kg-button>/);
    expect(tpl).toMatch(/<kg-button v-else variant="primary" size="sm" icon="monitor-down" @click="download\(m\.module\)">下载<\/kg-button>/);
    expect(legacyHit(expect, pages.offline, '.act')).toBe('componentized');
    expect(rule(styleOf(pages.offline), '.pkg')).toMatch(/display:\s*flex/);
  });

  it('海报页「保存图片 / 重新生成」与收件箱「去登录」：kg-button lg / kg-empty-state CTA', () => {
    const poster = templateOf(pages.poster);
    expect(poster).toMatch(/<kg-button variant="primary" size="lg" block icon="save" :disabled="!imgSrc" @click="save">保存图片<\/kg-button>/);
    expect(poster).toMatch(/cta-text="重新生成"\s+@cta="retry"/);
    expect(templateOf(pages.inbox)).toMatch(/cta-text="去登录"\s+@cta="goLogin"/);
    expect(legacyHit(expect, pages.poster, '.btn')).toBe('componentized');
    expect(legacyHit(expect, pages.inbox, '.login-btn')).toBe('componentized');
    // 收件箱 .act 是消息类型文字，不是可点元素
    expect(templateOf(pages.inbox)).toMatch(/<text v-if="it\.type === 'like'" class="act">/);
  });

  it('小队邀请页「登录 / 注册 ›」是 kg-button text lg；登录页「登录 / 注册」走 wd-segmented，项命中由 App.vue ::after 扩到 --hit-min', () => {
    expect(templateOf(pages.join)).toMatch(/<view class="reg-tip">\s*<kg-button variant="text" size="lg" @click="goLogin">登录 \/ 注册账号，打卡记录多端同步 ›<\/kg-button>/);
    expect(templateOf(pages.login)).toMatch(/<wd-segmented ref="seg" :value="modeLabel" :options="modeOpts" class="seg" @change="onModeChange" \/>/);
    expect(legacyHit(expect, pages.login, '.seg-item')).toBe('componentized');
    const seg = rule(styleOf(app), '.wd-segmented__item::after');
    expect(seg).toMatch(/content:\s*''/);
    expect(seg).toMatch(/position:\s*absolute/);
    expect(seg).toMatch(/height:\s*var\(--hit-min\)/);
    expect(seg).toMatch(/transform:\s*translateY\(-50%\)/);
  });
});
