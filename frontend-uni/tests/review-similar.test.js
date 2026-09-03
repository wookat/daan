import { describe, it, expect } from 'vitest';
import { similarItemFromQuestion, mistakeRecFromExtra } from '../src/review-similar.js';

const Q = {
  id: 646,
  module: 'changshi',
  question_type: '常识判断-历史',
  question: '下列有关中国古代史的说法正确的是？',
  options: { A: '甲', B: '乙', C: '丙', D: '丁' },
  answer: 'B',
  explanation: '解析文本',
};

describe('similarItemFromQuestion', () => {
  it('保留 question_id/question_type 并拼接题干选项', () => {
    const it_ = similarItemFromQuestion(Q);
    expect(it_._extra).toBe(true);
    expect(it_.question_id).toBe(646);
    expect(it_.question_type).toBe('常识判断-历史');
    expect(it_.module).toBe('changshi');
    expect(it_.question_text).toBe('下列有关中国古代史的说法正确的是？\nA.甲 B.乙 C.丙 D.丁');
    expect(it_.correct_answer).toBe('B');
    expect(it_.explanation).toBe('解析文本');
  });
  it('hs_explanation 优先于 explanation', () => {
    expect(similarItemFromQuestion({ ...Q, hs_explanation: '花生版' }).explanation).toBe('花生版');
  });
  it('无 question_type 回退 submodule', () => {
    expect(similarItemFromQuestion({ ...Q, question_type: null, submodule: '历史' }).question_type).toBe('历史');
  });
  it('非法 id fail-closed 为 null question_id', () => {
    expect(similarItemFromQuestion({ ...Q, id: 0 }).question_id).toBe(null);
    expect(similarItemFromQuestion({ ...Q, id: 'x' }).question_id).toBe(null);
  });
  it('无题干/非对象返回 null', () => {
    expect(similarItemFromQuestion({ ...Q, question: '' })).toBe(null);
    expect(similarItemFromQuestion(null)).toBe(null);
    expect(similarItemFromQuestion('str')).toBe(null);
  });
});

describe('mistakeRecFromExtra', () => {
  const item = similarItemFromQuestion(Q);
  it('构造 /api/mistakes 请求体', () => {
    const rec = mistakeRecFromExtra(item, 'A', 'u1');
    expect(rec).toEqual({
      uid: 'u1',
      question_id: 646,
      module: 'changshi',
      question_type: '常识判断-历史',
      question_text: item.question_text,
      user_answer: 'A',
      correct_answer: 'B',
      explanation: '解析文本',
    });
  });
  it('无作答 user_answer 为 null', () => {
    expect(mistakeRecFromExtra(item, '', 'u1').user_answer).toBe(null);
  });
  it('非 _extra/缺题干/缺正解 fail-closed 返回 null', () => {
    expect(mistakeRecFromExtra({ ...item, _extra: false }, 'A', 'u1')).toBe(null);
    expect(mistakeRecFromExtra({ ...item, question_text: '' }, 'A', 'u1')).toBe(null);
    expect(mistakeRecFromExtra({ ...item, correct_answer: '' }, 'A', 'u1')).toBe(null);
    expect(mistakeRecFromExtra(null, 'A', 'u1')).toBe(null);
  });
});
