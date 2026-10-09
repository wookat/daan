// R539：错题本入口卡「开始重练」（redoAll，/api/mistakes/redo 无 mids）此前对手录/无题库原题行静默少题——
// 服务端只回 items，前端只能在 0 题时提示。现服务端回 skipped（本次加载口径），redoAll 沿用 R527 redoNote →
// 练习页开场 toast「已加载 N 题，另 M 题为手录/无题库原题，无法重练」；旧后端无 skipped 字段时行为不变。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { redoSkippedNote } from '../src/book-redo-skipped.js';
import { redoSkippedNote as mpRedoSkippedNote } from '../../miniapp-native/miniprogram/utils/redo-note.ts';

const BOOK = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8')+readFileSync(new URL('../src/pages/book/review-ops.js', import.meta.url), 'utf8');
const mp = (p) => readFileSync(fileURLToPath(new URL('../../miniapp-native/miniprogram/' + p, import.meta.url)), 'utf8');

function redoAllBody() {
  const m = /async redoAll\(\) \{([\s\S]*?)\n {4}\},/.exec(BOOK);
  expect(m).not.toBeNull();
  return m[1];
}

// 与 book.vue redoAll 同一表达式：expected = 回包条数 + skipped
const noteFor = (d) => redoSkippedNote(d.items.length + (Number(d.skipped) || 0), d.items.length);

describe('redoAll 部分匹配说明（H5）', () => {
  it('服务端 skipped>0 → 练习页开场并入 R527 口径文案', () => {
    expect(noteFor({ items: [{}, {}, {}], skipped: 2 })).toBe('已加载 3 题，另 2 题为手录/无题库原题，无法重练');
    expect(noteFor({ items: [{}], skipped: 1 })).toBe('已加载 1 题，另 1 题为手录/无题库原题，无法重练');
  });
  it('全部匹配 / 旧后端无 skipped / skipped 非法 → 无说明，保持原「错题重练开始」', () => {
    expect(noteFor({ items: [{}, {}], skipped: 0 })).toBe('');
    expect(noteFor({ items: [{}, {}] })).toBe('');
    expect(noteFor({ items: [{}, {}], skipped: 'x' })).toBe('');
    expect(noteFor({ items: [{}, {}], skipped: null })).toBe('');
  });
  it('redoAll 源码：0 题仍走「未能匹配」toast 返回；有题写 redoSet → redoNote → 跳转，不在本页直接 toast', () => {
    const body = redoAllBody();
    expect(body).toContain("uni.showToast({ title: '错题未能匹配到题库原题', icon: 'none' });");
    expect(body).toContain("uni.setStorageSync('redoNote', redoSkippedNote(d.items.length + (Number(d.skipped) || 0), d.items.length));");
    expect(body).not.toContain('uni.showToast({ title: redoSkippedNote(');
    expect(body.indexOf("uni.setStorageSync('redoSet', d.items)")).toBeLessThan(body.indexOf("uni.setStorageSync('redoNote'"));
    expect(body.indexOf("uni.setStorageSync('redoNote'")).toBeLessThan(body.indexOf("uni.navigateTo({ url: '/pages/practice/practice' })"));
  });
  it('redoSel 仍按勾选数 − 回包数（不叠加 skipped，避免重复计）', () => {
    const m = /async redoSel\(\) \{([\s\S]*?)\n {4}\},/.exec(BOOK);
    expect(m[1]).toContain("uni.setStorageSync('redoNote', redoSkippedNote(ids.length, d.items.length));");
    expect(m[1]).not.toContain('d.skipped');
  });
});

describe('小程序同口径', () => {
  it('utils/redo-note 文案与 H5 逐字相同', () => {
    for (const [s, l] of [[3, 2], [5, 1], [3, 3], [3, 0], [2, 5], [undefined, undefined]]) {
      expect(mpRedoSkippedNote(s, l)).toBe(redoSkippedNote(s, l));
    }
  });
  it('book.ts onRedo 把 skipped 经 query 交给练习页；practice.ts 开场 toast 并入说明，无说明保持原文案', () => {
    const learn = mp('api/learn.ts');
    expect(learn).toContain('Promise<{ items: Question[]; skipped?: number }>');
    const book = mp('pages/book/book.ts');
    expect(book).toContain('const skipped = Math.max(0, Number(d.skipped) || 0);');
    expect(book).toContain("(skipped ? '&skipped=' + skipped : '')");
    const practice = mp('pages/practice/practice.ts');
    expect(practice).toContain("import { redoSkippedNote } from '../../utils/redo-note';");
    expect(practice).toContain('skipped: Math.max(0, Number(query.skipped) || 0),');
    expect(practice).toContain('const note = redoSkippedNote(d.items.length + (Number(d.skipped) || args.skipped), d.items.length);');
    expect(practice).toContain("if (note) wx.showToast({ title: '错题重练开始 · ' + note, icon: 'none', duration: 3500 });");
    expect(practice).toContain("else wx.showToast({ title: '错题重练开始', icon: 'none' });");
    // 「本组错题重练」从当前组错题集合出发，不带上一次的 skipped
    expect(practice).toContain("mode: 'redoset', count: wrong.length, ptitle: '本组错题重练', skipped: 0");
  });
});
