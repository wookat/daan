// R525：错题本导出 PDF 含无题库 id 的行（时政 NULL-qid / 手录）时，这些题只进正文与参考答案、不上机读答题卡
// （后端 sheet_questions 只放有 id 的题，槽位与 paper_exports.question_ids 同序）；导出确认层先把题数口径说清。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const BOOK = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8');
const CONFIRM = readFileSync(new URL('../src/components/export-confirm/export-confirm.vue', import.meta.url), 'utf8');

function sheetlessNote(ctx) {
  const m = /sheetlessNote\(\) \{\n([\s\S]*?)\n {4}\},/.exec(CONFIRM);
  if (!m) throw new Error('sheetlessNote not found');
  return new Function('return (function(){' + m[1] + '}).call(this)').call(ctx);
}

describe('export-confirm sheetless 提示', () => {
  it('有 sheetless 且含答题卡时显示口径；仅答案 / 不含答题卡 / 0 题不显示', () => {
    expect(CONFIRM).toContain('sheetless: { type: Number, default: 0 },');
    expect(CONFIRM).toContain('<view v-if="sheetlessNote" class="opt-note sheetless">{{ sheetlessNote }}</view>');
    expect(sheetlessNote({ only: false, withSheet: true, sheetless: 1, count: 2 })).toBe('其中 1 题（时政/手录）不上机读答题卡，请对照参考答案核对');
    expect(sheetlessNote({ only: false, withSheet: true, sheetless: 1, count: 1 })).toBe('所选均为时政/手录题，无机读答题卡，请对照参考答案核对');
    // count 未传（首页「按当前设置组卷」）不按全量口径
    expect(sheetlessNote({ only: false, withSheet: true, sheetless: 1, count: null })).toContain('其中 1 题');
    expect(sheetlessNote({ only: true, withSheet: true, sheetless: 1 })).toBe('');
    expect(sheetlessNote({ only: false, withSheet: false, sheetless: 1 })).toBe('');
    expect(sheetlessNote({ only: false, withSheet: true, sheetless: 0 })).toBe('');
    expect(sheetlessNote({ only: false, withSheet: true, sheetless: undefined })).toBe('');
  });
});

describe('错题本接入', () => {
  it('exportSheetless 与 exportMistakes 的 items 过滤同谓词（无 question_id 且有题干）并传给确认层', () => {
    expect(BOOK).toContain(':sheetless="exportSheetless"');
    expect(BOOK).toContain(
      "return this.exportList.slice(0, 100).filter((m) => !m.question_id && (m.question_text || '').trim()).length;",
    );
    expect(BOOK).toContain(".filter((m) => !m.question_id && (m.question_text || '').trim())\n          .map((m) => ({");
  });
});
