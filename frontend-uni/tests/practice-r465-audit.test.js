import { describe, it, expect } from 'vitest';
import { read, styleOf, templateOf, rule, legacyHit, assertHitLayer, HIT40, BOX40 } from './_w5-hit.js';

const src = read('pages/practice/practice.vue');
const style = styleOf(src);
const tpl = templateOf(src);

// R465：核心作答页字号下限 / 可点元素热区。W5 起 header 答题卡入口 / 退出 / ✕ / 有用·有误 / 纠错 / 详解 /
// 去登录·开启 换成 kg-* 组件（命中区在组件层 --hit-min）；页面自绘的错因/举报类型 chip 与顶栏仍逐条锁规则。
describe('R465 作答页字号下限 / 可点元素热区（源文件锁）', () => {
  it('样式块内无 <24rpx 字号（375 下 <12px），也无 <12px 字面字号', () => {
    expect(style).not.toMatch(/font-size:\s*(?:1\d|2[0-3])rpx/);
    expect(style).not.toMatch(/font-size:\s*(?:[1-9]|1[01])(?:\.\d+)?px/);
  });

  it('组件层命中规则（tokens / kg-button / kg-sheet / kg-chip-row / kg-section-header / kg-banner）', () => assertHitLayer(expect));

  it('答题卡入口 .top-mod 命中 44 且 min-width:0 让模块标签可省略；退出 .icon-btn 44×44 负外边距不抬顶栏', () => {
    expect(tpl).toMatch(/<view class="top-mod" role="button" aria-label="打开答题卡" @click="cardOpen = true">/);
    expect(rule(style, '.top-mod')).toMatch(/min-height:\s*var\(--hit-min\)/);
    expect(rule(style, '.top-mod')).toMatch(/min-width:\s*0/);
    expect(tpl).toMatch(/<view class="icon-btn" role="button" aria-label="退出练习" hover-class="tool-hover" @click="quit">/);
    expect(rule(style, '.icon-btn')).toMatch(BOX40);
    expect(rule(style, '.icon-btn')).toMatch(/margin-right:\s*calc\(-1 \* var\(--sp-8\)\)/);
    for (const s of ['.tag', '.tag-t', '.op']) expect(legacyHit(expect, src, s), s).toBe('componentized');
  });

  it('错因自评 / 举报类型 chip .rz 40px 药丸（页面自绘）；选项走 kg-option-group', () => {
    expect(tpl).toMatch(/class="rz"\s+:class="\{ on: cur\._reason === rz \}"\s+role="button"/);
    expect(tpl).toMatch(/class="rz"\s+:class="\{ on: reportType === t \}"\s+role="button"/);
    expect(rule(style, '.rz')).toMatch(HIT40);
    expect(tpl).toMatch(/<kg-option-group\s+:options="optList"/);
    expect(legacyHit(expect, src, '.rp-chip')).toBe('componentized');
  });

  it('✕ / 有用·有误 / 纠错 / 详解 / 强化 / 回错题本 / 去登录·开启 / 材料折叠：由 kg-sheet / kg-button / kg-banner 承担', () => {
    for (const s of ['.sheet-x', '.loginnudge-x', '.lead-x', '.hs-rate-btn', '.report-link', '.deep', '.wr-btn', '.rr-go', '.duenudge-go', '.mat-fold', '.fixreport', '.fontbtn']) {
      expect(legacyHit(expect, src, s), s).toBe('componentized');
    }
    expect(tpl).toMatch(/<kg-button variant="ghost" size="sm" icon="thumbs-up" @click="rateHs\(cur, true\)">有用<\/kg-button>/);
    expect(tpl).toMatch(/<kg-button variant="ghost" size="sm" tone="bad" icon="thumbs-down" @click="rateHs\(cur, false\)">有误<\/kg-button>/);
    expect(tpl).toMatch(/<kg-button variant="secondary" size="md" block icon="sparkles" @click="deepExplain">用花生十三方法详解这道题<\/kg-button>/);
    expect(tpl).toMatch(/<kg-button v-if="!cur\._sz" variant="text" size="sm" @click="reportQuestion">/);
    expect(tpl).toMatch(/action-text="去登录"\s+@action="loginNudgeGo"\s+@close="dismissLoginNudge"/);
    expect(tpl).toMatch(/<kg-banner v-if="leadHint && idx === 0" class="lead-tag" tone="info" :text="leadHint" @close="leadHint = ''" \/>/);
    expect(tpl.match(/<kg-sheet v-model="(?:cardOpen|toolsOpen|reportOpen)"/g) || []).toHaveLength(3);
  });

  it('弱项行 .wr-row 整行 ≥44（内含 kg-button 时不再另撑高）', () => {
    expect(rule(style, '.wr-row')).toMatch(/min-height:\s*var\(--hit-min\)/);
  });
});
