import { describe, it, expect } from 'vitest';
import { examPosterData } from '../src/exam-poster.js';

const rep = (over = {}) => ({
  attempt: { id: 9, score: 61.55 },
  correct: 40,
  total: 75,
  paper: { id: 5, title: '2025年国考行测', kind: 'zhenti' },
  ...over
});

describe('examPosterData', () => {
  it('缺 report/attempt/score/total 返回 null', () => {
    expect(examPosterData(null, null)).toBeNull();
    expect(examPosterData({}, null)).toBeNull();
    expect(examPosterData(rep({ attempt: null }), null)).toBeNull();
    expect(examPosterData(rep({ attempt: { id: 9, score: null } }), null)).toBeNull();
    expect(examPosterData(rep({ attempt: { id: 9, score: 'x' } }), null)).toBeNull();
    expect(examPosterData(rep({ total: 0 }), null)).toBeNull();
  });

  it('基础字段与得分一位小数', () => {
    const d = examPosterData(rep(), null);
    expect(d.title).toBe('2025年国考行测');
    expect(d.score).toBe(61.6);
    expect(d.correct).toBe(40);
    expect(d.total).toBe(75);
    expect(d.beatenPct).toBeNull();
  });

  it('rank 样本 >=10 才给击败比例（取整）', () => {
    expect(examPosterData(rep(), { total: 10, beaten_pct: 72.4 }).beatenPct).toBe(72);
    expect(examPosterData(rep(), { total: 9, beaten_pct: 72.4 }).beatenPct).toBeNull();
    expect(examPosterData(rep(), { total: 20, beaten_pct: 'x' }).beatenPct).toBeNull();
    expect(examPosterData(rep(), null).beatenPct).toBeNull();
  });

  it('zhenti 卷 QR 落同卷 SSR 页，mock/mini/缺 id 落站点根', () => {
    expect(examPosterData(rep(), null).qrUrl).toBe('https://kaogong.zalize.com/tiku/papers/5');
    expect(examPosterData(rep({ paper: { id: 5, title: 't', kind: 'mock' } }), null).qrUrl).toBe('https://kaogong.zalize.com');
    expect(examPosterData(rep({ paper: { title: 't', kind: 'zhenti' } }), null).qrUrl).toBe('https://kaogong.zalize.com');
  });

  it('paper 缺失回落默认标题', () => {
    const d = examPosterData(rep({ paper: null }), null);
    expect(d.title).toBe('模拟考试');
    expect(d.qrUrl).toBe('https://kaogong.zalize.com');
  });
});
