// R516：时政错题（/api/shizheng/daily 来源）落库 question_type='单选'（生产 27/27 行、8 uid），
// 错题本卡片标签 / 操作单标题「单选 · 更多操作」/ 题型分组都把作答形式当成了题型 → 退回模块名「时政」
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const BOOK = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8');

function tagNameFrom(src) {
  const names = /const NAMES = (\{[^\n]*\});/.exec(src)[1];
  const formats = /const ANSWER_FORMATS = (\[[^\n]*\]);/.exec(src)[1];
  const body = /tagName\(m\) \{\n([\s\S]*?)\n {4}\},/.exec(src)[1];
  return new Function(
    'm',
    `const NAMES = ${names}; const ANSWER_FORMATS = ${formats};
     const self = { modName: (k) => NAMES[k] || k || '' };
     ${body.replace(/this\./g, 'self.')}`
  );
}

describe('book.vue tagName', () => {
  const tagName = tagNameFrom(BOOK);
  it('只描述作答形式的 question_type 退回模块名', () => {
    expect(BOOK).toContain("const ANSWER_FORMATS = ['单选', '多选', '判断', '不定项'];");
    expect(BOOK).toContain("if (!qt || ANSWER_FORMATS.includes(qt)) return this.modName(m.module);");
    expect(tagName({ module: '时政', question_type: '单选', question_id: null })).toBe('时政');
    expect(tagName({ module: 'panduan', question_type: '多选' })).toBe('判断推理');
  });
  it('行测题型标签 / 「模块名-题型」去前缀 / 无题型退模块名 不变', () => {
    expect(tagName({ module: 'ziliao', question_type: '比重' })).toBe('比重');
    expect(tagName({ module: 'panduan', question_type: '定义判断' })).toBe('定义判断');
    expect(tagName({ module: 'changshi', question_type: '政治-理论' })).toBe('理论');
    expect(tagName({ module: 'yanyu', question_type: null })).toBe('言语理解');
    expect(tagName({ module: 'changshi', question_type: '' })).toBe('常识判断');
  });
  it('操作单标题与分组键仍走 tagName（时政操作单标题为「时政 · 更多操作」）', () => {
    expect(BOOK).toContain(":title=\"moreSheet ? tagName(moreSheet.m) + ' · 更多操作' : ''\"");
    expect(BOOK).toContain("return this.tagName(m) || '其他';");
  });
});
