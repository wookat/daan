// R559：错因自评 chip 再点已选项取消（清为「未标注」）——小程序三处入口与 H5 同口径：
// 练习页答错错因 / 错题本复习页 kg-chip-row（toggle）/ 模考报告解析浮层。kg-chip-row 默认（筛选行）再点已选项仍不发事件。
// 运行：cd miniapp-native && ../frontend-uni/node_modules/.bin/vitest run --config scripts/vitest.config.mts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const chip = read('../miniprogram/components/kg-chip-row/index.ts');
const practice = read('../miniprogram/pages/practice/practice.ts');
const book = read('../miniprogram/pages/book/book.ts');
const bookWxml = read('../miniprogram/pages/book/book.wxml');
const report = read('../miniprogram/pkgExam/report/report.ts');

describe('R559 小程序错因 chip 取消语义', () => {
  it('kg-chip-row：toggle 属性默认 false；再点已选项 toggle 时发 change{value:""}，否则不发事件', () => {
    expect(chip).toContain("toggle: { type: Boolean, value: false },");
    expect(chip).toContain('if (value === this.data.value) {');
    expect(chip).toContain("if (this.data.toggle) this.triggerEvent('change', { value: '' });");
    expect(chip).toMatch(/if \(value === this\.data\.value\) \{\n\s+if \(this\.data\.toggle\) [^\n]+\n\s+return;\n\s+\}/);
  });

  it('练习页 onSetReason：同值再点 → ""，落 cur._reason 与 PATCH', () => {
    expect(practice).toContain("const next = cur._reason === rz ? '' : rz;");
    expect(practice).toContain("this.setData({ 'cur._reason': next });");
    expect(practice).toContain('if (cur._mid) patchMistakeReason(cur._mid, next).catch(() => {});');
  });

  it('错题本复习页：chip-row 开 toggle，onReviewReason 接受空值并 PATCH，埋点空值记「未标注」', () => {
    expect(bookWxml).toContain('value="{{rCur.error_reason || \'\'}}" toggle bind:change="onReviewReason"');
    expect(book).toContain("const rz = String(e.detail.value || '');\n    const cur = this.data.rCur;\n    if (!cur || cur.extra) return;");
    expect(book).toContain("trackEvent('review_reason_tag', rz || '未标注');");
    // 其余筛选 chip-row 不开 toggle
    const rows = bookWxml.match(/<kg-chip-row[^\n]*\/>/g) || [];
    expect(rows.filter((r) => /\stoggle\s/.test(r)).length).toBe(1);
  });

  it('模考报告解析浮层 onReason：同值再点 → ""，报告项同步、失败回滚', () => {
    expect(report).toContain('if (!d || !d.mistake_id || !rz) return;');
    expect(report).toContain("const next = prev === rz ? '' : rz;");
    expect(report).toContain("this.setData({ 'detail.error_reason': next });");
    expect(report).toContain('await patchMistake(d.mistake_id, { error_reason: next });');
    expect(report).toContain('if (it) it.error_reason = next;');
    expect(report).toContain("this.setData({ 'detail.error_reason': prev });");
  });

  // R559-fix：onPick 里 saveWrong 异步、saveSession 同步先落快照（items 只写 _picked/_secs）→ 恢复出的题无 _mid，错因自评不发 PATCH。
  it('练习页 saveWrong 回包后把 _mid/_saved 写回 items[i] 并补写快照', () => {
    const fn = practice.slice(practice.indexOf('async saveWrong(q: PQuestion, picked: string) {'), practice.indexOf('onSetReason('));
    expect(fn).toContain('const i = this.data.items.findIndex((it) => it === q || (q.id != null && it.id === q.id));');
    expect(fn).toContain('if (i < 0 || this.data.finished) return;');
    expect(fn).toContain('this.setData({ [`items[${i}]._mid`]: q._mid, [`items[${i}]._saved`]: true });');
    expect(fn).toMatch(/_saved`\]: true \}\);\n\s+this\.saveSession\(\);\n\s+\},\n\s*\/\/[^\n]*\n\s*$/);
  });
});
