// R532：手动录入层查卷时带 uid（GET /api/paper/{code}?uid=），回包 submitted_pages（该账号对该卷已判过分的记录：
// 手动录入整卷 page 0、扫描答题卡 1..P，含 first_at/last_at/n）→ 进层即出「这份卷你已判过分：…」，不必录完 N 题再被告知 dup。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { paperSubmittedNote, scanWhen, scanDupNote } from '../src/paper-scan-pages.js';

const BOOK = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8')+readFileSync(new URL('../src/pages/book/review-ops.js', import.meta.url), 'utf8');
const now = new Date(2026, 8, 8, 16, 30).getTime();
const t = (M, D, h, m) => new Date(2026, M - 1, D, h, m).getTime() / 1000;

describe('scanWhen', () => {
  it('同日「今天 HH:MM」、跨日「M月D日 HH:MM」、无效回 fallback；scanDupNote 复用同一格式', () => {
    expect(scanWhen(t(9, 8, 9, 5), now)).toBe('今天 09:05');
    expect(scanWhen(t(9, 7, 21, 40), now)).toBe('9月7日 21:40');
    expect(scanWhen(0, now)).toBe('此前');
    expect(scanWhen(null, now, '')).toBe('');
    expect(scanDupNote({ dup: true, dup_at: t(9, 8, 9, 5), page: 1 }, now)).toContain('今天 09:05');
  });
  it('同一 created_at：结果 sheet dup 说明行与录入层提示行时刻文案逐字相同（同源 scanWhen，跨日含月日）', () => {
    for (const at of [t(9, 8, 9, 5), t(9, 5, 8, 46), t(12, 31, 23, 59)]) {
      const when = scanWhen(at, now);
      expect(scanDupNote({ dup: true, dup_at: at, page: 0 }, now)).toContain('已于 ' + when + ' 判分');
      expect(paperSubmittedNote({ n: 1, submitted_pages: [{ page: 0, first_at: at, last_at: at, n: 1 }] }, now)).toContain('手动录入 ' + when + '；');
    }
  });
});

describe('paperSubmittedNote', () => {
  it('无 uid 回包 / 空数组 / 缺字段不出', () => {
    expect(paperSubmittedNote(null)).toBe('');
    expect(paperSubmittedNote({ n: 12, pages: 1 })).toBe('');
    expect(paperSubmittedNote({ n: 12, pages: 1, submitted_pages: [] })).toBe('');
    expect(paperSubmittedNote({ n: 12, submitted_pages: 'x' })).toBe('');
  });
  it('手动录入整卷 page 0 → 「手动录入 时间」；多次不同作答带次数', () => {
    expect(paperSubmittedNote({ n: 12, pages: 1, submitted_pages: [{ page: 0, first_at: t(9, 8, 8, 36), last_at: t(9, 8, 8, 36), n: 1 }] }, now)).toBe(
      '这份卷你已判过分：手动录入 今天 08:36；再次交卷时作答完全相同不会重复记录，有改动会记为新的作答',
    );
    expect(paperSubmittedNote({ n: 12, pages: 1, submitted_pages: [{ page: 0, first_at: t(9, 5, 8, 36), last_at: t(9, 8, 10, 2), n: 2 }] }, now)).toBe(
      '这份卷你已判过分：手动录入 今天 10:02（2 次不同作答）；再次交卷时作答完全相同不会重复记录，有改动会记为新的作答',
    );
  });
  it('扫描页与手动录入并存按回包顺序列出，扫描页说「答题卡第 N 页」', () => {
    const p = {
      n: 60,
      pages: 2,
      submitted_pages: [
        { page: 0, first_at: t(9, 7, 21, 40), last_at: t(9, 7, 21, 40), n: 1 },
        { page: 2, first_at: t(9, 8, 9, 5), last_at: t(9, 8, 9, 5), n: 1 },
      ],
    };
    expect(paperSubmittedNote(p, now)).toBe(
      '这份卷你已判过分：手动录入 9月7日 21:40 · 答题卡第 2 页 今天 09:05；再次交卷时作答完全相同不会重复记录，有改动会记为新的作答',
    );
  });
});

describe('book.vue 源锁', () => {
  it('查卷带 uid；录入层在 n>0 时出 paperSubmittedNote（warn 样式）、n=0 仍走 R527 文案不出', () => {
    expect(BOOK).toContain("this.manualPaper = await request('/api/paper/' + encodeURIComponent(code) + '?uid=' + encodeURIComponent(anonUid()));");
    expect(BOOK).toContain('<text v-if="manualPaper.n && paperSubmittedNote(manualPaper)" class="scan-note scan-dup">{{ paperSubmittedNote(manualPaper) }}</text>');
    expect(BOOK).toContain("import { scanPageLabel, scanPagesNote, scanDupNote, paperSubmittedNote, recordScanPage } from '../../paper-scan-pages.js';");
    expect(BOOK).toMatch(/methods:[\s\S]*paperSubmittedNote,/);
  });
});
