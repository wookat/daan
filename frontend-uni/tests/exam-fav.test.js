import { describe, it, expect } from 'vitest';
import { isFaved, toggleFav } from '../src/exam-fav.js';

const item = {
  question: '甲题干',
  options: { A: '1', B: '2' },
  answer: 'A',
  explanation: '解析',
  hs_explanation: '',
  module: 'yanyu',
  submodule: '逻辑填空',
  is_real: 1,
  exam_year: 2023,
  exam_region: '国考',
  image: '',
  image_credit: '',
};

describe('isFaved', () => {
  it('按题干判断收藏态', () => {
    expect(isFaved([{ question: '甲题干' }], '甲题干')).toBe(true);
    expect(isFaved([{ question: '甲题干' }], '乙题干')).toBe(false);
  });

  it('非法输入容错', () => {
    expect(isFaved(null, '甲题干')).toBe(false);
    expect(isFaved([{ question: '甲题干' }], '')).toBe(false);
  });
});

describe('toggleFav', () => {
  it('未收藏则头插并保留来源字段', () => {
    const { list, added } = toggleFav([{ question: '旧题' }], item);
    expect(added).toBe(true);
    expect(list[0].question).toBe('甲题干');
    expect(list[0].exam_year).toBe(2023);
    expect(list[0].is_real).toBe(1);
    expect(list[1].question).toBe('旧题');
  });

  it('已收藏则移除', () => {
    const { list, added } = toggleFav([{ question: '甲题干' }, { question: '旧题' }], item);
    expect(added).toBe(false);
    expect(list.map((f) => f.question)).toEqual(['旧题']);
  });

  it('不修改原数组', () => {
    const orig = [{ question: '旧题' }];
    toggleFav(orig, item);
    expect(orig.length).toBe(1);
  });

  it('上限 200 截断', () => {
    const favs = Array.from({ length: 200 }, (_, i) => ({ question: 'q' + i }));
    const { list } = toggleFav(favs, item);
    expect(list.length).toBe(200);
    expect(list[0].question).toBe('甲题干');
  });

  it('缺题干容错不变更', () => {
    const { list, added } = toggleFav([{ question: '旧题' }], { question: '' });
    expect(added).toBe(false);
    expect(list.length).toBe(1);
  });
});
