// R558：错答反馈信息层级与 H5 同口径——错因自评（选填）从判分横幅之后下移到解析卡内「解析之后、讲解区操作之前」。
// 运行：cd miniapp-native && ../frontend-uni/node_modules/.bin/vitest run --config scripts/vitest.config.mts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const wxml = read('../miniprogram/pages/practice/practice.wxml');
const wxss = read('../miniprogram/pages/practice/practice.wxss');
const ts = read('../miniprogram/pages/practice/practice.ts');

const at = (s: string) => {
  const i = wxml.indexOf(s);
  expect(i, `wxml 缺少 ${s}`).toBeGreaterThan(-1);
  return i;
};

describe('R558 小程序错答反馈信息层级', () => {
  it('顺序：判分横幅 → 解析卡（用时/考点/来源/解析/笔记）→ 错因自评（选填）→ 讲解区操作（AI/讨论/笔记/纠错）', () => {
    const banner = at('class="banner {{beiMode');
    const card = at('class="exp-card"');
    const exp = at('<text class="exp-lab">解析</text>');
    const reasons = at('class="reasons" role="group" aria-label="错因自评"');
    const acts = at('class="exp-acts"');
    const cardEnd = wxml.indexOf('</kg-card>', card);
    expect(banner).toBeLessThan(card);
    expect(card).toBeLessThan(exp);
    expect(exp).toBeLessThan(reasons);
    expect(reasons).toBeLessThan(acts);
    expect(acts).toBeLessThan(cardEnd);
    expect(wxml).toContain('<text class="rz-t">错因自评（选填）</text>');
    expect(wxml).toContain('wx:if="{{picked && picked !== cur.answer}}" class="reasons"');
  });

  it('卡内错因块用 exp-block 同一套分隔线，不再带卡间距', () => {
    expect(wxss).toMatch(/\.exp-card \.reasons \{\s*margin: var\(--sp-16\) 0 0;\s*padding-top: var\(--sp-12\);\s*border-top: 1px solid var\(--line\);/);
  });

  it('答对自动推进口径不变（1200ms、看解析仅 autoNext 时显示）；onStayHere 追加 practice_stay_here 埋点', () => {
    expect(ts).toMatch(/if \(correct && this\.data\.autoNext\) \{\s*this\.clearAutoTimer\(\);\s*this\._autoTimer = setTimeout\(\(\) => \{\s*this\._autoTimer = 0;\s*if \(this\.data\.cur === cur && this\.data\.picked\) this\.onNext\(\);\s*\}, 1200\);/);
    expect(wxml).toContain('wx:if="{{!beiMode && picked === cur.answer && autoNext}}" variant="text" size="sm" bind:click="onStayHere">看解析</kg-button>');
    const stay = ts.slice(ts.indexOf('onStayHere() {'), ts.indexOf('async logAttempts('));
    expect(stay).toContain('this.clearAutoTimer()');
    expect(stay).toContain("trackEvent('practice_stay_here', this._source || 'practice')");
  });
});
