// R531：同卷同页完全相同的作答重复判分（重扫同一张卡 / 手动录入重复交卷）后端只落库一次，回包 saved=false + dup=true + dup_at；
// 结果 sheet 出说明行、「看错题 ›」在 dup 时仍可跳（错题已在首次落库）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { scanDupNote } from '../src/paper-scan-pages.js';
import { scanRowJumpable } from '../src/paper-scan-jump.js';

const BOOK = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8');
const wrong = { no: 2, question_id: 112, status: 'ok', correct: false, picked: 'A', answer: 'C' };

describe('scanDupNote', () => {
  const now = new Date(2026, 8, 8, 16, 30).getTime();
  it('非 dup / 空回包不出', () => {
    expect(scanDupNote(null)).toBe('');
    expect(scanDupNote({ saved: true, dup: false })).toBe('');
  });
  it('扫描（有 page）说「这一页」，手动录入（无 page）说「这份答案」；同日显示「今天 HH:MM」，跨日带月日', () => {
    const at = new Date(2026, 8, 8, 9, 5).getTime() / 1000;
    expect(scanDupNote({ dup: true, dup_at: at, page: 1 }, now)).toBe(
      '这一页已于 今天 09:05 判分并记入做题记录；本次答案完全相同，未重复记录，复习进度不受影响',
    );
    const yday = new Date(2026, 8, 7, 21, 40).getTime() / 1000;
    expect(scanDupNote({ dup: true, dup_at: yday }, now)).toBe(
      '这份答案已于 9月7日 21:40 判分并记入做题记录；本次答案完全相同，未重复记录，复习进度不受影响',
    );
    expect(scanDupNote({ dup: true, dup_at: null, page: 2 }, now)).toBe(
      '这一页已于 此前 判分并记入做题记录；本次答案完全相同，未重复记录，复习进度不受影响',
    );
  });
});

describe('scanRowJumpable 对 dup 回包', () => {
  it('saved=false 但 dup=true 的 ✗ 行仍可跳；其余谓词不变', () => {
    expect(scanRowJumpable({ saved: false, dup: true }, wrong)).toBe(true);
    expect(scanRowJumpable({ saved: false, dup: false }, wrong)).toBe(false);
    expect(scanRowJumpable({ saved: false, dup: true }, { ...wrong, correct: true })).toBe(false);
    expect(scanRowJumpable({ saved: false, dup: true }, { ...wrong, status: 'blank' })).toBe(false);
  });
});

describe('错题本接入', () => {
  it('结果 sheet 在汇总行下、页数说明行上出 scan-dup 说明行；import 与 methods 接入', () => {
    expect(BOOK).toContain("import { scanPageLabel, scanPagesNote, scanDupNote, recordScanPage } from '../../paper-scan-pages.js';");
    expect(BOOK).toContain(
      '<text v-if="scanDupNote(scanResult)" class="scan-note scan-dup">{{ scanDupNote(scanResult) }}</text>\n' +
        '          <text v-if="scanPagesNote(scanResult, scanAcc)" class="scan-note">{{ scanPagesNote(scanResult, scanAcc) }}</text>',
    );
    expect(BOOK).toContain('    scanPagesNote,\n    scanDupNote,\n');
    expect(BOOK).toContain('.scan-dup { color: var(--warn-strong); background: var(--warn-soft);');
  });
});
