import { describe, it, expect } from 'vitest';
import { toastAnnounceText, pickAnnounceText } from '../src/live-policy';

describe('toastAnnounceText', () => {
  it('可见且文案非空时通报（trim 后）', () => {
    expect(toastAnnounceText(true, ' 保存成功 ', '')).toBe('保存成功');
  });
  it('隐藏不通报', () => {
    expect(toastAnnounceText(false, '保存成功', '')).toBe('');
  });
  it('空/纯空白文案不通报', () => {
    expect(toastAnnounceText(true, '', '')).toBe('');
    expect(toastAnnounceText(true, '  \n ', '')).toBe('');
    expect(toastAnnounceText(true, null, '')).toBe('');
  });
  it('与上一次可见文案相同不重复通报（同一次展示的多次 mutation）', () => {
    expect(toastAnnounceText(true, '保存成功', '保存成功')).toBe('');
  });
  it('上一次隐藏后再次出现相同文案可再通报', () => {
    expect(toastAnnounceText(true, '保存成功', '')).toBe('保存成功');
  });
});

describe('pickAnnounceText', () => {
  it('答对', () => {
    expect(pickAnnounceText(true, 'B', 1)).toBe('回答正确');
  });
  it('答对且连对 ≥3 外显连对数', () => {
    expect(pickAnnounceText(true, 'B', 3)).toBe('回答正确，连对 3 题');
  });
  it('答错通报正确答案', () => {
    expect(pickAnnounceText(false, 'C', 0)).toBe('回答错误，正确答案 C');
  });
});
