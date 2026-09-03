import { describe, it, expect } from 'vitest';
import { similarItemFromQuestion, mistakeRecFromExtra, reviewReasonMid, reviewAskAnswer } from '../src/review-similar.js';

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

describe('reviewReasonMid', () => {
  it('普通复习条目返回错题 id', () => {
    expect(reviewReasonMid({ id: 12 })).toBe(12);
  });
  it('加练条目入库后返回 _mid', () => {
    expect(reviewReasonMid({ _extra: true, _mid: 88 })).toBe(88);
  });
  it('加练条目未入库/非法 _mid fail-closed 返回 null', () => {
    expect(reviewReasonMid({ _extra: true })).toBe(null);
    expect(reviewReasonMid({ _extra: true, _mid: 0 })).toBe(null);
    expect(reviewReasonMid({ _extra: true, _mid: 'x' })).toBe(null);
  });
  it('非法 id/非对象 fail-closed 返回 null', () => {
    expect(reviewReasonMid({ id: 'x' })).toBe(null);
    expect(reviewReasonMid({})).toBe(null);
    expect(reviewReasonMid(null)).toBe(null);
  });
});

describe('reviewAskAnswer', () => {
  it('加练条目取本轮作答 picked', () => {
    expect(reviewAskAnswer({ _extra: true }, 'B')).toBe('B');
    expect(reviewAskAnswer({ _extra: true, user_answer: 'A' }, 'C')).toBe('C');
  });
  it('普通条目取历史作答 user_answer', () => {
    expect(reviewAskAnswer({ user_answer: 'D' }, 'A')).toBe('D');
  });
  it('加练无本轮作答/多选/非法 fail-closed 空串', () => {
    expect(reviewAskAnswer({ _extra: true }, null)).toBe('');
    expect(reviewAskAnswer({ _extra: true }, 'ABD')).toBe('');
    expect(reviewAskAnswer({ _extra: true }, 'x')).toBe('');
  });
  it('普通条目无/非法 user_answer 与非对象 fail-closed 空串', () => {
    expect(reviewAskAnswer({}, 'B')).toBe('');
    expect(reviewAskAnswer(null, 'B')).toBe('');
    expect(reviewAskAnswer('x', 'B')).toBe('');
  });
});
