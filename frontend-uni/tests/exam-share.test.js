import { describe, it, expect } from 'vitest';
import { buildExamReportShareText } from '../src/exam-share.js';

const rep = (over = {}, paperOver = {}) => ({
  correct: 55,
  total: 130,
  paper: { id: 42, title: '2023年国考行测真题卷', kind: 'zhenti', ...paperOver },
  ...over,
});

describe('buildExamReportShareText', () => {
  it('zhenti 卷输出文案 + SSR 落地页链接', () => {
    const t = buildExamReportShareText(rep(), 'https://kaogong.zalize.com');
    expect(t).toBe(
      '我在错题邦模考《2023年国考行测真题卷》答对 55/130 题，敢来挑战吗？同卷在线模考：https://kaogong.zalize.com/tiku/papers/42'
    );
  });

  it('mini 模考卷不外显分享', () => {
    expect(buildExamReportShareText(rep({}, { kind: 'mock' }), 'https://x')).toBe('');
  });

  it('缺 paper/id/title 返回空', () => {
    expect(buildExamReportShareText(null, 'https://x')).toBe('');
    expect(buildExamReportShareText({ correct: 1, total: 2 }, 'https://x')).toBe('');
    expect(buildExamReportShareText(rep({}, { id: 0 }), 'https://x')).toBe('');
    expect(buildExamReportShareText(rep({}, { title: '' }), 'https://x')).toBe('');
  });

  it('correct/total 非法回落 0，origin 缺省为空串', () => {
    const t = buildExamReportShareText(rep({ correct: null, total: undefined }));
    expect(t).toContain('答对 0/0 题');
    expect(t).toContain('：/tiku/papers/42');
  });
});
