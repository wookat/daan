// R528：错题本「扫描答题卡 / 手动录入」结果 sheet 与录入层对混合卷（普通题 + 时政/手录内联题）说明
// 「另 M 题不参与机读判分」——后端 paper/{code}、paper_answers、scan_sheet 回包 inline_n 只做说明，
// total/answered/correct 仍是机读普通题口径，OMR 槽位契约（R525）不动。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { inlineSkipNote } from '../src/paper-inline-note.js';

const BOOK = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8');

describe('inlineSkipNote', () => {
  it('有内联题说明条数与核对方式；0 / 缺省 / 非法值不出文案', () => {
    expect(inlineSkipNote(2)).toBe('另 2 题为时政/手录题，不参与机读判分，请对照卷末参考答案核对');
    expect(inlineSkipNote('1')).toBe('另 1 题为时政/手录题，不参与机读判分，请对照卷末参考答案核对');
    expect(inlineSkipNote(0)).toBe('');
    expect(inlineSkipNote(undefined)).toBe('');
    expect(inlineSkipNote(null)).toBe('');
    expect(inlineSkipNote('x')).toBe('');
    expect(inlineSkipNote(-1)).toBe('');
  });
});

describe('错题本接入', () => {
  it('结果 sheet：总结行下按回包 inline_n 出说明，逐题行仍只渲染机读 items', () => {
    expect(BOOK).toContain("import { inlineSkipNote } from '../../paper-inline-note.js';");
    expect(BOOK).toContain('  methods: {\n    inlineSkipNote,');
    expect(BOOK).toContain(
      "已作答 {{ scanResult.answered }}/{{ scanResult.total }} · 答对 <text class=\"scan-good num\">{{ scanResult.correct }}</text> 题{{ scanResult.saved ? ' · 已记入做题记录' : '' }}</text>\n" +
        '          <text v-if="scanDupNote(scanResult)" class="scan-note scan-dup">{{ scanDupNote(scanResult) }}</text>\n' +
        '          <text v-if="scanPagesNote(scanResult, scanAcc)" class="scan-note">{{ scanPagesNote(scanResult, scanAcc) }}</text>\n' +
        '          <text v-if="inlineSkipNote(scanResult.inline_n)" class="scan-note">{{ inlineSkipNote(scanResult.inline_n) }}</text>\n' +
        '          <view class="scan-list">\n            <view v-for="r in scanResult.items" :key="r.no" class="scan-row"',
    );
  });

  it('手动录入层：混合卷（n>0 且 inline_n>0）出说明；n=0 仍走 R527 全内联文案不重复', () => {
    expect(BOOK).toContain(
      '<text v-if="manualPaper.n && inlineSkipNote(manualPaper.inline_n)" class="scan-note">{{ inlineSkipNote(manualPaper.inline_n) }}</text>\n' +
        '          <text v-if="!manualPaper.n" class="manual-empty">',
    );
    expect(BOOK).toMatch(/\.scan-note \{[^}]*font-size: var\(--fs-sub\)[^}]*line-height: 1\.6/);
  });
});
