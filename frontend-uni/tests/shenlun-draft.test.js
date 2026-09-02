import { describe, it, expect } from 'vitest';
import { adoptServerDraft } from '../src/shenlun-draft.js';

describe('adoptServerDraft', () => {
  it('本机为空且服务端有内容时采用服务端草稿', () => {
    expect(adoptServerDraft('', { content: '云端草稿', updated_at: 1 })).toBe('云端草稿');
  });
  it('本机非空一律本机优先（不覆盖正在写的内容）', () => {
    expect(adoptServerDraft('本机内容', { content: '云端草稿', updated_at: 1 })).toBe(null);
  });
  it('本机为空且服务端也为空时不采用', () => {
    expect(adoptServerDraft('', { content: '', updated_at: 0 })).toBe(null);
  });
  it('非法输入容错：server 为 null/undefined/字段缺失', () => {
    expect(adoptServerDraft('', null)).toBe(null);
    expect(adoptServerDraft('', undefined)).toBe(null);
    expect(adoptServerDraft('', {})).toBe(null);
    expect(adoptServerDraft(null, { content: '云' })).toBe('云');
  });
});
