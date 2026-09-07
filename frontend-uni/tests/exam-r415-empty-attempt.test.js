import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseExamProgress, countAnswered, shouldPushProgress } from '../src/exam-resume.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const NOW = 1_700_000_000_000;

describe('R415 一题未答的模考不算未交卷进度', () => {
  it('countAnswered 只数有 _picked 的项，容忍非数组', () => {
    expect(countAnswered([{ _picked: 'A' }, { _picked: '' }, null, { _picked: 'BD' }])).toBe(2);
    expect(countAnswered(undefined)).toBe(0);
  });

  it('parseExamProgress：0 已答返回 null（首页/卷库不出续考卡），有作答照常', () => {
    const base = { attemptId: 9, paperId: 5, paper: { id: 5, title: 'x' }, idx: 3, endAt: NOW + 90_000 };
    expect(parseExamProgress({ ...base, items: [{ _picked: '' }, {}, { _marked: true }] }, NOW)).toBeNull();
    expect(parseExamProgress({ ...base, items: [{ _picked: '' }, { _picked: 'C' }] }, NOW).answered).toBe(1);
  });

  it('shouldPushProgress：无作答且从未推送过 → 不写服务端（只打旗标同样不写，与服务端回收口径一致）；推送过后一律同步', () => {
    expect(shouldPushProgress({}, false)).toBe(false);
    expect(shouldPushProgress(undefined, undefined)).toBe(false);
    expect(shouldPushProgress({ 1: 'A' }, false)).toBe(true);
    expect(shouldPushProgress({}, true)).toBe(true);
  });

  it('exam.vue：续考弹窗要求 countAnswered>0；pushProgress 接 shouldPushProgress 并记 _progPushed', () => {
    const src = read('../src/pkgA/exam/exam.vue');
    expect(src).toMatch(/countAnswered\(saved\.items\) > 0\n\s*\) \{/);
    expect(src).toContain("if (!shouldPushProgress(picks, this._progPushed)) return;");
    expect(src).toContain('this._progPushed = true;\n      request(\'/api/exam/progress\'');
    // 恢复快照时视为已推送过，之后清空作答也会同步
    expect(src).toMatch(/if \(resume\) \{\n\s*this\._progPushed = true;/);
  });

  it('exam.vue：离页 flush（onUnload/onHide）与打旗标（toggleMark）都只经 pushProgress 一处闸门，不存在绕过 shouldPushProgress 的直发', () => {
    const src = read('../src/pkgA/exam/exam.vue');
    expect(src.match(/request\('\/api\/exam\/progress'/g)).toHaveLength(1);
    expect(src).toMatch(/onUnload\(\) \{[\s\S]*?this\.saveProgress\(\);\n\s*this\.flushProgress\(\);/);
    expect(src).toMatch(/onHide\(\) \{\n\s*this\.saveProgress\(\);\n\s*this\.flushProgress\(\);/);
    expect(src).toMatch(/flushProgress\(\) \{\n\s*clearTimeout\(this\._progTimer\);\n\s*this\.pushProgress\(\);/);
    expect(src).toMatch(/toggleMark\(\) \{\n\s*this\.cur\._marked = !this\.cur\._marked;\n\s*this\.saveProgress\(\);/);
    // 只标记未作答离页：picks 为空且从未推送 → 0 请求；恢复后仅加标记：已视为推送过 → marks 随同一 payload 同步
    expect(shouldPushProgress({}, false)).toBe(false);
    expect(shouldPushProgress({ 273036: 'BD' }, true)).toBe(true);
  });
});
