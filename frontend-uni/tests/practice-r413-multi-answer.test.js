import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../src/pages/practice/practice.vue', import.meta.url)), 'utf8');

describe('R413 多选题（answer 多字母）可作答（源文件锁）', () => {
  it('pick 在多选题上只切换选中，确认后按选项顺序拼字母提交', () => {
    expect(src).toMatch(/isMulti\(\)\s*\{[\s\S]*?answer\.trim\(\)\.length > 1/);
    expect(src).toMatch(/pick\(k\)\s*\{[\s\S]*?if \(this\.isMulti\) \{[\s\S]*?multiSel[\s\S]*?return;[\s\S]*?\}\s*this\.commitPick\(k\);/);
    expect(src).toMatch(/confirmMulti\(\)[\s\S]*?Object\.keys\(this\.cur\.options[\s\S]*?\.join\(''\)[\s\S]*?this\.commitPick\(k\)/);
  });
  it('选项正误标记按字母包含判断（多选正确项全部 ✓），有确认按钮且 ≥44px', () => {
    expect(src).toMatch(/hasKey\(cur\.answer, k\)" class="omark good"/);
    expect(src).toMatch(/hasKey\(picked, k\)" class="omark badm"/);
    expect(src).toMatch(/v-if="isMulti && !picked && !beiMode" class="multi-bar"/);
    expect(src).toMatch(/\.multi-ok \{[^}]*min-height: 44px/);
    expect(src).not.toMatch(/k === this\.cur\.answer \?|k === cur\.answer"|k === picked\b/);
  });
  it('切题清空多选暂存', () => {
    expect(src).toMatch(/idx\(\)\s*\{\s*this\.multiSel = \[\];/);
  });
});

describe('R413 复习页作答后「下一题/确认答案」吸底（源文件锁）', () => {
  const book = readFileSync(fileURLToPath(new URL('../src/pages/book/book.vue', import.meta.url)), 'utf8');
  it('next-btn sticky 且让出 H5 TabBar 50px', () => {
    const rule = (book.match(/\n:deep\(\.next-btn\) \{([^}]*)\}/) || [])[1] || '';
    expect(rule).toMatch(/position:\s*sticky/);
    expect(rule).toMatch(/bottom:\s*calc\(50px \+ env\(safe-area-inset-bottom\)/);
  });
  it('收藏/搜索/错题本收藏展示的正确项按字母包含标绿（多选全部标）', () => {
    for (const p of ['../src/pages/book/book.vue', '../src/pkgA/social/favorites.vue', '../src/pkgA/search/search.vue']) {
      const s = readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
      expect(s).not.toMatch(/k === (?:f|it|detail)\.answer/);
    }
  });
});
