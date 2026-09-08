// R529：错题本「扫描答题卡」结果 sheet 对多页卷（答题卡 PER_PAGE=50 分页）——后端只判上传那一页，
// 回包 pages 透出整卷页数：标题「第 N/P 页」+ 说明「本页只判第 a–b 题；其余页请分别扫描」；
// 结果 sheet 右上 ✕ / 遮罩关闭与「完成」同走 closeScan() → load()（已记入做题记录后列表即时刷新）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { scanPageLabel, scanPagesNote } from '../src/paper-scan-pages.js';
import { inlineSkipNote } from '../src/paper-inline-note.js';

const BOOK = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8');

const p1 = { page: 1, pages: 2, total: 50, items: [{ no: 1 }, { no: 50 }] };
const p2 = { page: 2, pages: 2, total: 10, items: [{ no: 51 }, { no: 60 }] };

describe('scanPageLabel', () => {
  it('多页卷「第 N/P 页」，单页卷保留「第 N 页」，手动录入回包（无 page）为空', () => {
    expect(scanPageLabel(p1)).toBe('第 1/2 页');
    expect(scanPageLabel(p2)).toBe('第 2/2 页');
    expect(scanPageLabel({ page: 1, pages: 1, total: 3 })).toBe('第 1 页');
    expect(scanPageLabel({ page: 1, total: 3 })).toBe('第 1 页');
    expect(scanPageLabel({ total: 3 })).toBe('');
    expect(scanPageLabel(null)).toBe('');
  });
});

describe('scanPagesNote', () => {
  it('多页卷按本页 items 首题号与 total 给出判分范围；单页卷 / 无 page / 空页不出文案', () => {
    expect(scanPagesNote(p1)).toBe('本卷答题卡共 2 页，本页只判第 1–50 题；其余页请分别扫描');
    expect(scanPagesNote(p2)).toBe('本卷答题卡共 2 页，本页只判第 51–60 题；其余页请分别扫描');
    expect(scanPagesNote({ page: 1, pages: 1, total: 3, items: [{ no: 1 }] })).toBe('');
    expect(scanPagesNote({ pages: 2, total: 50, items: [{ no: 1 }] })).toBe('');
    expect(scanPagesNote({ page: 3, pages: 2, total: 0, items: [] })).toBe('');
    expect(scanPagesNote(undefined)).toBe('');
  });
});

describe('错题本接入', () => {
  it('结果 sheet 标题用 scanPageLabel，多页说明行在 inline 说明行之前', () => {
    expect(BOOK).toContain("import { scanPageLabel, scanPagesNote } from '../../paper-scan-pages.js';");
    expect(BOOK).toContain('    inlineSkipNote,\n    scanPageLabel,\n    scanPagesNote,\n');
    expect(BOOK).toContain("卷码 {{ scanResult.code }}{{ scanPageLabel(scanResult) ? ' · ' + scanPageLabel(scanResult) : '' }} · 已作答");
    expect(BOOK).toContain(
      '<text v-if="scanPagesNote(scanResult)" class="scan-note">{{ scanPagesNote(scanResult) }}</text>\n' +
        '          <text v-if="inlineSkipNote(scanResult.inline_n)" class="scan-note">{{ inlineSkipNote(scanResult.inline_n) }}</text>',
    );
    expect(BOOK).not.toContain("' · 第 ' + scanResult.page + ' 页'");
  });

  it('导出确认层 M 题口径与录入层/结果 sheet 同源：同一计数谓词、同一「时政/手录 → 对照参考答案核对」锚点', () => {
    const CONFIRM = readFileSync(new URL('../src/components/export-confirm/export-confirm.vue', import.meta.url), 'utf8');
    const PRED = ".filter((m) => !m.question_id && (m.question_text || '').trim())";
    expect(BOOK).toContain('exportSheetless() {\n      return this.exportList.slice(0, 100)' + PRED + '.length;');
    expect(BOOK.split(PRED).length - 1).toBe(2);
    for (const s of [
      inlineSkipNote(1),
      '其中 1 题（时政/手录）不上机读答题卡，请对照参考答案核对',
      '所选均为时政/手录题，无机读答题卡，请对照参考答案核对',
    ]) {
      expect(s).toMatch(/时政\/手录/);
      expect(s).toMatch(/参考答案核对$/);
    }
    expect(CONFIRM).toContain("return '其中 ' + this.sheetless + ' 题（时政/手录）不上机读答题卡，请对照参考答案核对';");
    expect(CONFIRM).toContain("return '所选均为时政/手录题，无机读答题卡，请对照参考答案核对';");
  });

  it('结果 sheet ✕/遮罩与「完成」同走 closeScan()：关闭并 load() 刷新列表', () => {
    expect(BOOK).toContain('@update:model-value="(v) => { if (!v) closeScan(); }">\n        <template v-if="scanResult">');
    expect(BOOK).toContain('<kg-button variant="primary" size="lg" block @click="closeScan">完成</kg-button>');
    expect(BOOK).toContain('    closeScan() {\n      if (!this.scanOpen) return;\n      this.scanOpen = false;\n      this.load();\n    },');
    expect(BOOK).not.toContain('scanOpen = false; load()');
  });
});
