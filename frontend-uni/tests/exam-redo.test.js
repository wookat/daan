import { describe, it, expect } from 'vitest';
import { buildExamRedoSet } from '../src/exam-redo.js';

const wrong = (i, extra = {}) => ({
  no: i,
  question_id: 1000 + i,
  module: 'shuliang',
  submodule: '数学运算',
  question: '题干' + i,
  options: { A: 'a', B: 'b', C: 'c', D: 'd' },
  picked: 'A',
  answer: 'B',
  correct: false,
  explanation: '解析' + i,
  hs_explanation: '',
  image: null,
  image_credit: null,
  ...extra,
});

describe('buildExamRedoSet', () => {
  it('只收答错题并映射为 practice 兼容格式', () => {
    const items = [
      wrong(1),
      { ...wrong(2), picked: 'B', correct: true },
      { ...wrong(3), picked: '', correct: false },
      wrong(4, { image: '/img/q4.png', image_credit: '真题' }),
    ];
    const set = buildExamRedoSet(items);
    expect(set.map((q) => q.id)).toEqual([1001, 1004]);
    expect(set[0]).toMatchObject({ question: '题干1', answer: 'B', module: 'shuliang', submodule: '数学运算' });
    expect(set[1].image).toBe('/img/q4.png');
    expect(set[1].image_credit).toBe('真题');
  });

  it('上限 10 题', () => {
    const items = Array.from({ length: 15 }, (_, i) => wrong(i + 1));
    expect(buildExamRedoSet(items)).toHaveLength(10);
    expect(buildExamRedoSet(items, 3)).toHaveLength(3);
  });

  it('脏数据不进组：缺 question/options/answer/question_id', () => {
    const items = [
      wrong(1, { question: '' }),
      wrong(2, { options: null }),
      wrong(3, { answer: '' }),
      wrong(4, { question_id: null }),
      wrong(5),
    ];
    expect(buildExamRedoSet(items).map((q) => q.id)).toEqual([1005]);
  });

  it('空/非法输入返回空', () => {
    expect(buildExamRedoSet([])).toEqual([]);
    expect(buildExamRedoSet(null)).toEqual([]);
    expect(buildExamRedoSet(undefined)).toEqual([]);
  });
});
