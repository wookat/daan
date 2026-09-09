// R559：错因自评 chip 再点已选项取消（清为「未标注」）。
// 依据（源码一手核实）：同一控件在 7 处入口只有 1 处（错题本更多操作层 setItemReason）能取消，其余 6 处（H5 练习页/复习页/模考报告，
// 小程序练习/复习/报告）只能改选不能撤销；练习页药丸本就标 aria-pressed（切换语义）却不可切回；后端 PATCH 白名单已收 error_reason
// 且筛选把 NULL/'' 同视为「未标注」，更多操作层早已在发 ''。本轮统一为切换语义 + 后端把空/None 归一 NULL、非四档 400。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const chip = read('../src/components/kg-chip-row/kg-chip-row.vue');
const practice = read('../src/pages/practice/practice.vue');
const book = read('../src/pages/book/book.vue');
const report = read('../src/pkgA/exam/report.vue');
const api = read('../../backend/app/study_api.py');

describe('R559 错因 chip 取消语义', () => {
  it('KgChipRow：toggle prop 默认 false；开启时再点已选项发 ""，默认原值回发', () => {
    expect(chip).toContain("toggle: { type: Boolean, default: false },");
    expect(chip).toContain('@click="$emit(\'update:modelValue\', toggle && o.value === modelValue ? \'\' : o.value)"');
  });

  it('练习页 setReason：同值再点 → ""，PATCH 发 next；药丸仍 aria-pressed', () => {
    expect(practice).toContain("const next = q._reason === rz ? '' : rz;\n      q._reason = next;");
    expect(practice).toContain("data: { uid: anonUid(), error_reason: next } });");
    expect(practice).toContain(':aria-pressed="cur._reason === rz ? \'true\' : \'false\'"');
  });

  it('错题本：复习页错因 chip-row 开 toggle（筛选行不开）；更多操作层 setItemReason 保持既有自翻转（R410 已锁）', () => {
    const rows = book.match(/<kg-chip-row[^\n]*\/>/g) || [];
    const toggled = rows.filter((r) => /\stoggle\s/.test(r));
    expect(toggled.length).toBe(1);
    expect(toggled[0]).toContain('REASONS.map');
    expect(toggled[0]).toContain('@update:model-value="setReviewReason"');
    expect(book).toContain("const next = m.error_reason === rz ? '' : rz;");
    expect(book).toContain("trackEvent('review_reason_tag', rz || '未标注');");
  });

  it('模考报告解析浮层 setDetailReason：同值再点 → ""，失败回滚；chip 标 aria-pressed', () => {
    expect(report).toContain("const next = prev === rz ? '' : rz;\n      d.error_reason = next;");
    expect(report).toContain("data: { uid: anonUid(), error_reason: next } });");
    expect(report).toContain('d.error_reason = prev;');
    expect(report).toContain(':aria-pressed="detail.error_reason === rz ? \'true\' : \'false\'"');
  });

  it('后端 PATCH：error_reason 空/None → NULL，非四档 400（与 manual_mistake.MANUAL_REASONS 同集）', () => {
    expect(api).toContain('if "error_reason" in body:');
    expect(api).toContain('if rz and rz not in manual_mistake.MANUAL_REASONS:');
    expect(api).toContain('raise HTTPException(400, "错因不在可选范围")');
    expect(api).toContain('body = {**body, "error_reason": rz or None}');
  });
});
