import { describe, it, expect } from 'vitest';
import { mistakePaper, paperGroups, inPaper, PAPER_GROUP_MAX } from '../src/book-paper.js';

const P1 = { pid: 7, title: '2018年青海卷', psource: '2018年青海省考行测真题' };
const P2 = { pid: 9, title: '2024年河北卷', psource: '2024年河北省考行测真题' };

describe('mistakePaper（R368 归卷 fail-closed）', () => {
  it('合法 paper 归一化', () => {
    expect(mistakePaper({ paper: P1 })).toEqual(P1);
    expect(mistakePaper({ paper: { pid: 3, psource: ' 卷 ' } })).toEqual({ pid: 3, psource: '卷', title: '' });
  });
  it('非法输入回 null', () => {
    expect(mistakePaper(null)).toBeNull();
    expect(mistakePaper({})).toBeNull();
    expect(mistakePaper({ paper: null })).toBeNull();
    expect(mistakePaper({ paper: { pid: 0, psource: 'x' } })).toBeNull();
    expect(mistakePaper({ paper: { pid: '7', psource: 'x' } })).toBeNull();
    expect(mistakePaper({ paper: { pid: 1.5, psource: 'x' } })).toBeNull();
    expect(mistakePaper({ paper: { pid: 7, psource: '' } })).toBeNull();
    expect(mistakePaper({ paper: { pid: 7, psource: '   ' } })).toBeNull();
    expect(mistakePaper({ paper: { pid: 7 } })).toBeNull();
    expect(mistakePaper({ source: 'exam' })).toBeNull();
  });
});

describe('paperGroups', () => {
  it('按卷计数、数量降序、同数 pid 降序', () => {
    const items = [{ paper: P1 }, { paper: P2 }, { paper: P1 }, { paper: null }, {}, { paper: { pid: 0, psource: 'x' } }];
    expect(paperGroups(items)).toEqual([{ ...P1, n: 2 }, { ...P2, n: 1 }]);
    expect(paperGroups([{ paper: P1 }, { paper: P2 }])).toEqual([{ ...P2, n: 1 }, { ...P1, n: 1 }]);
  });
  it('上限截断 + 非数组回空', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ paper: { pid: i + 1, psource: 's' + i, title: 't' } }));
    expect(paperGroups(many).length).toBe(PAPER_GROUP_MAX);
    expect(paperGroups(many, 3).length).toBe(3);
    expect(paperGroups(null)).toEqual([]);
    expect(paperGroups('x')).toEqual([]);
    expect(paperGroups([])).toEqual([]);
  });
  it('不改原条目', () => {
    const m = { paper: { ...P1 } };
    paperGroups([m, m]);
    expect(m).toEqual({ paper: P1 });
  });
});

describe('inPaper', () => {
  it('严格 pid 匹配', () => {
    expect(inPaper({ paper: P1 }, 7)).toBe(true);
    expect(inPaper({ paper: P1 }, 9)).toBe(false);
    expect(inPaper({ paper: P1 }, '7')).toBe(false);
    expect(inPaper({}, 7)).toBe(false);
    expect(inPaper(null, 7)).toBe(false);
  });
});
