// R530：对答案结果 sheet「✗」行直达错题卡（saved + 有题库 id + 实答答错才可跳；关 sheet → load() → 定位并展开同 question_id 卡）
// + 多页卷各页都扫过后说明行改为整卷合计（仍是普通题口径；页内 items/total 契约不动；手动录入回包不计）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { scanRowJumpable, findScanMistake, pageNFor } from '../src/paper-scan-jump.js';
import { recordScanPage, scanAllPagesSummary, scanPagesNote } from '../src/paper-scan-pages.js';

const BOOK = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8');

const saved = { saved: true, code: 'ABCD1234' };
const wrong = { no: 2, question_id: 112, status: 'ok', correct: false, picked: 'A', answer: 'C' };

describe('scanRowJumpable', () => {
  it('只有已落库 + 有题库 id + 实答答错的行可跳；未涂/多涂/答对/未落库/无 id 都不可', () => {
    expect(scanRowJumpable(saved, wrong)).toBe(true);
    expect(scanRowJumpable({ saved: false, code: 'X' }, wrong)).toBe(false);
    expect(scanRowJumpable(saved, { ...wrong, correct: true })).toBe(false);
    expect(scanRowJumpable(saved, { ...wrong, status: 'blank' })).toBe(false);
    expect(scanRowJumpable(saved, { ...wrong, status: 'multi', picked: 'AB' })).toBe(false);
    expect(scanRowJumpable(saved, { ...wrong, question_id: 0 })).toBe(false);
    expect(scanRowJumpable(null, wrong)).toBe(false);
    expect(scanRowJumpable(saved, null)).toBe(false);
  });
});

describe('findScanMistake / pageNFor', () => {
  it('按 question_id 命中，待掌握优先于已掌握；无命中返回 null', () => {
    const items = [
      { id: 1, question_id: 112, mastered: 1 },
      { id: 2, question_id: 111, mastered: 0 },
      { id: 3, question_id: 112, mastered: 0 },
    ];
    expect(findScanMistake(items, 112).id).toBe(3);
    expect(findScanMistake(items, '111').id).toBe(2);
    expect(findScanMistake(items.slice(0, 1), 112).id).toBe(1);
    expect(findScanMistake(items, 999)).toBe(null);
    expect(findScanMistake(items, null)).toBe(null);
    expect(findScanMistake(null, 112)).toBe(null);
  });
  it('分页步长 20：目标下标进入已渲染范围，不缩小已有 pageN；不在列表返回原值', () => {
    expect(pageNFor(0, 20)).toBe(20);
    expect(pageNFor(19, 20)).toBe(20);
    expect(pageNFor(20, 20)).toBe(40);
    expect(pageNFor(45, 20)).toBe(60);
    expect(pageNFor(3, 60)).toBe(60);
    expect(pageNFor(-1, 40)).toBe(40);
  });
});

describe('多页卷整卷合计', () => {
  const p1 = { code: 'P60', page: 1, pages: 2, total: 50, answered: 3, correct: 2, items: [{ no: 1 }] };
  const p2 = { code: 'P60', page: 2, pages: 2, total: 10, answered: 3, correct: 1, items: [{ no: 51 }] };
  it('recordScanPage 按卷码/页号累计，同页重扫覆盖，单页卷与手动录入（无 page）不计', () => {
    let acc = recordScanPage({}, p1);
    expect(acc).toEqual({ P60: { 1: { answered: 3, correct: 2, total: 50 } } });
    acc = recordScanPage(acc, { ...p1, answered: 5, correct: 4 });
    expect(acc.P60[1]).toEqual({ answered: 5, correct: 4, total: 50 });
    expect(recordScanPage(acc, { code: 'S1', page: 1, pages: 1, total: 3, answered: 3, correct: 2 })).toBe(acc);
    expect(recordScanPage(acc, { code: 'M1', total: 3, answered: 3, correct: 2 })).toBe(acc);
    expect(recordScanPage(undefined, null)).toEqual({});
  });
  it('缺页时说明行仍是 R529「本页只判第 a–b 题；其余页请分别扫描」，全页齐后改为整卷合计（普通题口径）', () => {
    let acc = recordScanPage({}, p1);
    expect(scanPagesNote(p1, acc)).toBe('本卷答题卡共 2 页，本页只判第 1–50 题；其余页请分别扫描');
    expect(scanAllPagesSummary(acc, p1)).toBe(null);
    acc = recordScanPage(acc, p2);
    expect(scanAllPagesSummary(acc, p2)).toEqual({ answered: 6, correct: 3, total: 60 });
    expect(scanPagesNote(p2, acc)).toBe('本卷答题卡 2 页已全部判分 · 合计已作答 6/60 · 答对 3 题');
    expect(scanPagesNote(p1, acc)).toBe('本卷答题卡 2 页已全部判分 · 合计已作答 6/60 · 答对 3 题');
    expect(scanPagesNote(p1)).toBe('本卷答题卡共 2 页，本页只判第 1–50 题；其余页请分别扫描');
    expect(scanPagesNote({ ...p2, code: 'OTHER' }, acc)).toBe('本卷答题卡共 2 页，本页只判第 51–60 题；其余页请分别扫描');
  });
});

describe('错题本接入', () => {
  it('结果行：仅可跳行挂 click 监听（a11y-focus 只给有监听的元素补 tabindex/role）+ jump/role=button + 「看错题 ›」，点击走 scanRowJump → closeScan；说明行传 scanAcc', () => {
    expect(BOOK).toContain("import { scanRowJumpable, scanRowKey, findScanMistake, pageNFor } from '../../paper-scan-jump.js';");
    expect(BOOK).toContain("import { scanPageLabel, scanPagesNote, scanDupNote, recordScanPage } from '../../paper-scan-pages.js';");
    expect(BOOK).toContain(
      '<view v-for="r in scanResult.items" :key="scanRowKey(scanResult, r)" class="scan-row" :class="{ jump: scanRowJumpable(scanResult, r) }" :role="scanRowJumpable(scanResult, r) ? \'button\' : null" v-on="scanRowJumpable(scanResult, r) ? { click: () => scanRowJump(r) } : {}">',
    );
    expect(BOOK).not.toContain('class="scan-row" :class="{ jump: scanRowJumpable(scanResult, r) }" :role="scanRowJumpable(scanResult, r) ? \'button\' : null" @click=');
    expect(BOOK).toContain('<text v-if="scanRowJumpable(scanResult, r)" class="scan-jump">看错题 ›</text>');
    expect(BOOK).toContain('<text v-if="scanPagesNote(scanResult, scanAcc)" class="scan-note">{{ scanPagesNote(scanResult, scanAcc) }}</text>');
    expect(BOOK).toContain(
      '    scanRowJump(r) {\n      if (!scanRowJumpable(this.scanResult, r)) return;\n      this._pendingScanQid = r.question_id;\n' +
        "      trackEvent('book_scan_jump', this.scanResult.code || '', String(r.question_id));\n      this.closeScan();\n    },",
    );
    expect(BOOK).toContain('.scan-row.jump { min-height: var(--hit-min); }');
  });
  it('load() 真实回包后定位：待掌握/已掌握 tab、筛选不命中则清筛选、pageN 覆盖到目标、kbId + 展开 + 滚到卡；失败/账号切换清 pending', () => {
    expect(BOOK).toContain('        this.applyPendingKp();\n        this.applyPendingScanJump();\n');
    expect(BOOK).toContain("      const m = findScanMistake(this.items, qid);\n      if (!m) {\n        uni.showToast({ title: '错题本里未找到这道题', icon: 'none' });\n        return;\n      }\n      this.tab = m.mastered ? 'done' : 'todo';");
    expect(BOOK).toContain('      if (!this.shownItems.includes(m)) {\n        this.filterMod = \'\';\n        this.kpFilter = \'\';\n        this.kp3Filter = \'\';\n        this.srcFilter = \'\';\n        this.pidFilter = 0;\n        this.rzFilter = \'\';\n      }');
    expect(BOOK).toContain('      this.pageN = pageNFor(this.shownItems.indexOf(m), this.pageN);\n      this.kbId = m.id;\n      if (!m.open) this.toggleCard(m);');
    expect(BOOK).toContain("      if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });");
    expect(BOOK).toContain("          uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });\n        }\n        this._pendingScanQid = 0;\n      }\n      this.loading = false;\n    },");
    expect(BOOK).toContain('      this.scanAcc = {};\n      this._pendingScanQid = 0;\n');
  });
  it('扫描路径累计页结果（手动录入路径不累计）', () => {
    expect(BOOK).toContain('            this.scanAcc = recordScanPage(this.scanAcc, d);\n            this.scanResult = d;\n            this.scanOpen = true;');
    expect(BOOK.split('recordScanPage(this.scanAcc, d)').length - 1).toBe(1);
  });
});
