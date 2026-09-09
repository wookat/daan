import { describe, it, expect } from 'vitest';
import { isFaved, toggleFav, cloudFavId } from '../src/exam-fav.js';

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

describe('toggleFav 云端 id', () => {
  it('题库题带 question_id 时本地条目记 id，供错题本取消收藏同步云端', () => {
    const { list } = toggleFav([], { ...item, question_id: 182003 });
    expect(list[0].id).toBe(182003);
  });

  it('无 question_id（时政/内联）则 id 为 null', () => {
    const { list } = toggleFav([], item);
    expect(list[0].id).toBe(null);
  });
});

describe('cloudFavId', () => {
  it('新条目直接用自带 id，不依赖云列表', () => {
    expect(cloudFavId({ id: 7, question: '甲' })).toBe(7);
    expect(cloudFavId({ id: 7, question: '甲' }, [{ id: 9, question: '甲' }])).toBe(7);
  });

  it('历史条目无 id：按题干在云收藏列表回查', () => {
    const cloud = [{ id: 11, question: '乙' }, { id: 182003, question: '甲题干' }];
    expect(cloudFavId({ question: '甲题干' }, cloud)).toBe(182003);
  });

  it('云列表无同题干 / 无题干 / 非法输入 → null（时政本地收藏不误删云端）', () => {
    expect(cloudFavId({ question: '丙' }, [{ id: 11, question: '乙' }])).toBe(null);
    expect(cloudFavId({ question: '' }, [{ id: 11, question: '' }])).toBe(null);
    expect(cloudFavId({ question: '甲' })).toBe(null);
    expect(cloudFavId(null, [{ id: 1, question: '甲' }])).toBe(null);
  });
});
