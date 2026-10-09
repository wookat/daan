// R527：登记项实修——R521-1「重练所选」回包少于勾选数时可见说明（手录/无题库原题 fail-closed 跳过不再静默）
// + R526-1 手动录入层对 n=0 全内联卷（时政/手录，无机读答题卡）给解释文案并收起「交卷判分」。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { redoSkippedNote } from '../src/book-redo-skipped.js';

const BOOK = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8')+readFileSync(new URL('../src/pages/book/review-ops.js', import.meta.url), 'utf8');
const PRACTICE = readFileSync(new URL('../src/pages/practice/practice.vue', import.meta.url), 'utf8');

describe('redoSkippedNote', () => {
  it('少题时说明条数；未少题 / 0 题（另有「未能匹配」toast）不出文案', () => {
    expect(redoSkippedNote(3, 2)).toBe('已加载 2 题，另 1 题为手录/无题库原题，无法重练');
    expect(redoSkippedNote(5, 1)).toBe('已加载 1 题，另 4 题为手录/无题库原题，无法重练');
    expect(redoSkippedNote(3, 3)).toBe('');
    expect(redoSkippedNote(3, 0)).toBe('');
    expect(redoSkippedNote(2, 5)).toBe('');
    expect(redoSkippedNote(undefined, undefined)).toBe('');
  });
});

describe('错题本接入', () => {
  it('redoSel 回包少于勾选数时把说明交给练习页（本页 toast 会被练习页「错题重练开始」覆盖）', () => {
    expect(BOOK).toContain("import { redoSkippedNote } from '../../book-redo-skipped.js';");
    const m = /async redoSel\(\) \{([\s\S]*?)\n {4}\},/.exec(BOOK);
    expect(m).not.toBeNull();
    const body = m[1];
    expect(body).toContain("uni.setStorageSync('redoNote', redoSkippedNote(ids.length, d.items.length));");
    expect(body).not.toContain('uni.showToast({ title: redoSkippedNote(');
    // 写在 redoSet 之后、跳转之前，且不改变「0 题 → 未能匹配 toast 并返回」分支
    expect(body.indexOf("uni.setStorageSync('redoSet', d.items)")).toBeLessThan(body.indexOf("uni.setStorageSync('redoNote'"));
    expect(body.indexOf("uni.setStorageSync('redoNote'")).toBeLessThan(body.indexOf("uni.navigateTo({ url: '/pages/practice/practice' })"));
    expect(body).toContain("uni.showToast({ title: '选中的错题未能匹配到题库原题', icon: 'none' });");
  });

  it('练习页消费 redoNote：有说明则并入开始 toast，无说明保持原文案；读后即清，不留给下次重练', () => {
    expect(PRACTICE).toContain("const redoNote = uni.getStorageSync('redoNote');\n    uni.removeStorageSync('redoNote');");
    expect(PRACTICE).toContain("if (redoNote) uni.showToast({ title: '错题重练开始 · ' + redoNote, icon: 'none', duration: 3500 });");
    expect(PRACTICE).toContain("else uni.showToast({ title: '错题重练开始', icon: 'none' });");
    expect(PRACTICE.indexOf("uni.removeStorageSync('redoNote')")).toBeLessThan(PRACTICE.indexOf('if (redoSet && redoSet.length) {'));
  });

  it('练习页残留的 exportPaper() 副本（v3 5-tab 后模板已无入口）已删，导出只剩首页一份', () => {
    expect(PRACTICE).not.toContain('exportPaper');
    expect(PRACTICE).not.toContain('exportPdf');
    expect(PRACTICE).not.toMatch(/\bexp(Sheet|Ans|Only)\b/);
    const HOME = readFileSync(new URL('../src/pages/home/home.vue', import.meta.url), 'utf8');
    expect(HOME).toContain('async exportPaper(opts) {');
  });

  it('手动录入层 n=0：解释文案替代题号行，交卷按钮不渲染，「换一份试卷」保留', () => {
    expect(BOOK).toContain(
      '<text v-if="!manualPaper.n" class="manual-empty">这张卷的题目均为时政/手录题，不参与机读判分，无需在此录入；请对照卷末参考答案核对</text>',
    );
    expect(BOOK).toContain('<view v-else class="scan-list">\n            <view v-for="no in manualPaper.n" :key="no" class="manual-row">');
    expect(BOOK).toContain('<kg-button v-if="manualPaper.n" variant="primary" size="lg" block :disabled="!manualPickedCount"');
    expect(BOOK).toContain('<kg-button variant="text" size="md" block @click="manualPaper = null">‹ 换一份试卷</kg-button>');
    expect(BOOK).toMatch(/\.manual-empty \{[^}]*font-size: var\(--fs-sub\)/);
  });
});
