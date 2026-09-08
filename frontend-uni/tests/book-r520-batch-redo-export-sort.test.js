// R520：错题本批量模式补「重练所选 / 导出所选」（对标粉笔错题本：勾选即可重做/导出，而非只能按筛选取前 100 条）
// + 排序补「最早」（粉笔评论区多次提出的按新旧排序需求）。源码锁 + 逻辑抽取执行。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildBookUrl, parseBookOpts, BOOK_PATH } from '../src/book-url.js';

const BOOK = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8');

function methodBody(name) {
  const re = new RegExp(`\\n {4}(?:async )?${name}\\([^)]*\\) \\{\\n([\\s\\S]*?)\\n {4}\\},`);
  const m = re.exec(BOOK);
  if (!m) throw new Error('method not found: ' + name);
  return m[1];
}

describe('批量条动作', () => {
  it('待复习 tab 有「重练」/「导出」，已掌握 tab 只有「导出」（无重练）', () => {
    const bar = /<view v-if="batchMode && tab !== 'fav'" class="batchbar">([\s\S]*?)\n {6}<\/view>\n/.exec(BOOK)[1];
    expect(bar).toContain(`v-if="tab === 'todo'" variant="primary" size="md" aria-label="重练所选错题" :disabled="!selCount || batchBusy" @click="redoSel">重练<`);
    expect(bar).toContain(`aria-label="导出所选为 PDF" :disabled="!selCount || batchBusy || exporting" @click="openExportSel">导出<`);
    expect(bar).not.toMatch(/v-if="tab === 'done'"[^>]*redoSel/);
    // 既有三动作保留
    expect(bar).toContain('@click="batchMaster(true)">标已掌握<');
    expect(bar).toContain('@click="batchMaster(false)">恢复复习<');
    expect(bar).toContain('@click="batchDel">删除<');
  });

  it('批量条允许换行、动作组右对齐整体折行（375 五个按钮不挤窄）', () => {
    expect(BOOK).toMatch(/\.batchbar \{[^}]*display: flex; flex-wrap: wrap;/);
    expect(BOOK).toMatch(/\.bb-acts \{ display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var\(--sp-8\); margin-left: auto; \}/);
  });
});

describe('redoSel', () => {
  const body = methodBody('redoSel');
  it('只带未掌握的勾选行 id 走 mids=，limit=25，超 25 条提示不发请求，成功写 redoSet 进练习页', () => {
    expect(body).toContain("const ids = this.selItems.filter((m) => !m.mastered).map((m) => m.id);");
    expect(body).toContain('if (ids.length > 25) {');
    expect(body).toContain("'/api/mistakes/redo?limit=25&uid=' + encodeURIComponent(anonUid()) + '&mids=' + ids.join(',')");
    expect(body).toContain("trackEvent('book_redo_sel', 'book', String(d.items.length));");
    expect(body).toContain("uni.setStorageSync('redoSet', d.items);");
    expect(body).toContain("uni.navigateTo({ url: '/pages/practice/practice' });");
    expect(body).toContain('this.batchBusy = false;');
  });

  it('selItems 取当前 tab 全量（不只本页），与 batchMaster/batchDel 同源', () => {
    expect(BOOK).toContain("selItems() {\n      const base = this.tab === 'done' ? this.doneItems : this.todoItems;\n      return base.filter((m) => this.selIds[m.id]);\n    },");
  });
});

describe('导出所选', () => {
  it('exportList 按 exportSel 切换来源；弹层范围/题数跟随；关闭复位', () => {
    expect(BOOK).toContain("exportList() {\n      return this.exportSel ? this.selItems : this.shownItems;\n    },");
    expect(BOOK).toContain(`:scope="exportSel ? '错题本 · 已选' : '错题本 · 当前筛选'"`);
    expect(BOOK).toContain(':count="Math.min(exportList.length, 100)"');
    expect(BOOK).toContain('@close="closeExport"');
    expect(methodBody('closeExport')).toContain('this.exportSel = false;');
    expect(methodBody('openExportSel')).toContain('this.exportSel = true;\n      this.exportConfirm = true;');
  });
  it('exportMistakes 用 exportList 且成功后复位 exportSel；空提示区分两种来源', () => {
    const body = methodBody('exportMistakes');
    expect(body).toContain('const list = this.exportList.slice(0, 100);');
    expect(body).toContain("throw new Error(this.exportSel ? '没有选中的错题' : '当前筛选没有错题');");
    expect(body).toContain('this.exportConfirm = false;\n        this.exportSel = false;');
  });
});

describe('排序「最早」', () => {
  it('SORTS 表含 old 且 shownItems 按 created_at 升序', () => {
    expect(BOOK).toContain("{ k: 'old', name: '最早' },");
    expect(BOOK).toContain("else if (this.sortBy === 'old') base.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));");
  });
  it('book-url 白名单接受 old（可分享/刷新恢复）', () => {
    expect(buildBookUrl({ sort: 'old' })).toBe(BOOK_PATH + '?sort=old');
    expect(parseBookOpts({ sort: 'old' }).sort).toBe('old');
    expect(parseBookOpts({ sort: 'time' }).sort).toBe('');
  });
});
