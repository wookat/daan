import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { askQid } from '../../miniapp-native/miniprogram/utils/ask-sessions.ts';

const mp = (p) => readFileSync(fileURLToPath(new URL('../../miniapp-native/miniprogram/' + p, import.meta.url)), 'utf8');

// R536：小程序问答页深链带入的题库 qid 此前只存在本地记录里，未随 /api/explain/stream 发给服务端
// （H5 api.js 自 R421 起就带 question_id）；服务端因此对每道刷题深链题都走识题 LLM，且缓存命中时
// 回包无 qid → applyMeta 把本地 qid 覆盖成空 → 「加入错题本」落 question_id NULL（R535 id 2836 形态）。
const store = {};
const calls = [];
const uploads = [];
function sseChunk(type, data) {
  const s = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(s).buffer;
}
globalThis.wx = {
  getStorageSync: (k) => store[k] || '',
  setStorageSync: (k, v) => {
    store[k] = v;
  },
  removeStorageSync: (k) => {
    delete store[k];
  },
  request(opts) {
    calls.push(opts);
    let chunkCb = null;
    setTimeout(() => {
      if (opts.enableChunked) {
        chunkCb({ data: sseChunk('meta', { module: 'yanyu', qid: opts.data.question_id ? 9 : null, cached: false }) });
        chunkCb({ data: sseChunk('message', { d: '讲解' }) });
        chunkCb({ data: sseChunk('done', {}) });
        opts.success({ statusCode: 200, header: {} });
      } else {
        opts.success({ statusCode: 200, data: { module: 'yanyu', explanation: '非流式' } });
      }
    }, 0);
    return { onChunkReceived: (cb) => (chunkCb = cb), abort() {} };
  },
  uploadFile(opts) {
    uploads.push(opts);
    setTimeout(() => opts.success({ statusCode: 200, data: JSON.stringify({ module: 'yanyu', explanation: '图片题' }) }), 0);
    return { abort() {} };
  },
};
const { streamExplain } = await import('../../miniapp-native/miniprogram/api/social.ts');

describe('R536 小程序 streamExplain：深链 qid 随 /api/explain/stream 发给服务端', () => {
  beforeEach(() => {
    calls.length = 0;
  });
  it('questionId>0 → 表单带 question_id，服务端回 meta.qid 透传给 onMeta/返回值', async () => {
    let meta = null;
    const d = await streamExplain({ text: '题干', userAnswer: 'B', questionId: 9, onMeta: (m) => (meta = m), onDelta() {} });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/api\/explain\/stream$/);
    expect(calls[0].enableChunked).toBe(true);
    expect(calls[0].header['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(calls[0].data).toEqual({ text: '题干', user_answer: 'B', question_id: 9 });
    expect(meta.qid).toBe(9);
    expect(d.qid).toBe(9);
    expect(d.explanation).toBe('讲解');
  });
  it('questionId 为 0 / null / 负数 / 缺省 → 不带 question_id 键（与 H5 `questionId > 0` 同口径）', async () => {
    for (const questionId of [0, null, -3, undefined]) {
      calls.length = 0;
      await streamExplain({ text: '题干', questionId, onDelta() {} });
      expect(calls[0].data).toEqual({ text: '题干' });
      expect('question_id' in calls[0].data).toBe(false);
    }
  });
  it('图片题走非流式 wx.uploadFile /api/explain，不带 question_id（服务端 /api/explain 无该字段；图片题也无题库 id）', async () => {
    const d = await streamExplain({ filePath: 'wxfile://a.jpg', text: null, userAnswer: 'A', questionId: 9, onDelta() {} });
    expect(calls).toHaveLength(0);
    expect(uploads).toHaveLength(1);
    expect(uploads[0].url).toMatch(/\/api\/explain$/);
    expect(uploads[0].formData).toEqual({ user_answer: 'A' });
    expect(d.explanation).toBe('图片题');
  });
});

describe('R536 源锁：ask.ts 传 qid + applyMeta 保留本地 qid；同款题保存仍 question_id: null', () => {
  const ts = mp('pkgSocial/ask/ask.ts');
  it('streamExplain 调用带 questionId: qid || null', () => {
    expect(ts).toMatch(/streamExplain\(\{\s*filePath: img \|\| null,\s*text: txt \|\| null,\s*userAnswer: uans \|\| null,\s*questionId: qid \|\| null,/);
  });
  it('applyMeta：服务端确认 qid 优先，缺省时保留深链 qid（缓存命中回包无 qid 不再清空）', () => {
    expect(ts).toMatch(/function applyMeta\(r: Rec, m: ExplainMeta\): void \{[\s\S]*?r\.qid = askQid\(m\.qid\) \|\| r\.qid;/);
  });
  it('普通保存 question_id: r.qid || null；同款题（LLM 生成、非题库题）保存 question_id: null 不变', () => {
    expect(ts).toMatch(/postMistake\(\{\s*question_id: r\.qid \|\| null,/);
    expect(ts).toMatch(/postMistake\(\{\s*question_id: null,\s*module: r\.module,[\s\S]*?question_text: simQuestionText\(r\.sim\),/);
  });
  it('askQid：服务端 qid 数字/数字串取正整数，null/0/"abc" → 0（|| 回落本地 qid）', () => {
    expect(askQid(9)).toBe(9);
    expect(askQid('12')).toBe(12);
    expect(askQid(null)).toBe(0);
    expect(askQid(0)).toBe(0);
    expect(askQid('abc')).toBe(0);
    expect(askQid(1.5)).toBe(0);
  });
  it('ExplainMeta/ExplainArgs 契约含 qid / questionId', () => {
    const api = mp('api/social.ts');
    expect(api).toMatch(/export interface ExplainMeta \{[\s\S]*?qid\?: number \| null;/);
    expect(api).toMatch(/export interface ExplainArgs extends SseHandlers<ExplainMeta> \{[\s\S]*?questionId\?: number \| null;/);
    expect(api).toMatch(/\.\.\.\(questionId && questionId > 0 \? \{ question_id: questionId \} : \{\}\),/);
  });
});
