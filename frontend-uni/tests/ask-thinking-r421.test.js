// R421：讲解流 thinking 心跳 → 流式卡占位文案；ask 页把已知 qid 随讲解请求上送（题库直通跳识题 LLM）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { thinkingSecs, thinkingLabel } from '../src/ask-link.js';
import { parseSseEvents } from '../src/api-policy.js';

const ASK = readFileSync(new URL('../src/pages/ask/ask.vue', import.meta.url), 'utf8');
const API = readFileSync(new URL('../src/api.js', import.meta.url), 'utf8');

describe('thinkingSecs', () => {
  it('取整正秒数，其余 0', () => {
    expect(thinkingSecs({ secs: 12, chars: 900 })).toBe(12);
    expect(thinkingSecs({ secs: 3.9 })).toBe(3);
    expect(thinkingSecs({ secs: '7' })).toBe(7);
    expect(thinkingSecs({ secs: 0 })).toBe(0);
    expect(thinkingSecs({ secs: -1 })).toBe(0);
    expect(thinkingSecs({})).toBe(0);
    expect(thinkingSecs(null)).toBe(0);
    expect(thinkingSecs([5])).toBe(0);
    expect(thinkingSecs({ secs: 'x' })).toBe(0);
  });
});

describe('thinkingLabel', () => {
  it('未收到心跳保持原文案', () => {
    expect(thinkingLabel(0)).toBe('生成中…');
    expect(thinkingLabel(undefined)).toBe('生成中…');
  });
  it('收到心跳后显示推理计时，30 s 起换「接近完成」', () => {
    expect(thinkingLabel(1)).toBe('AI 正在推理…（已 1 秒）');
    expect(thinkingLabel(29)).toBe('AI 正在推理…（已 29 秒）');
    expect(thinkingLabel(30)).toMatch(/接近完成.*已 30 秒/);
    expect(thinkingLabel(65)).toMatch(/已 65 秒/);
  });
});

describe('SSE thinking 事件解析', () => {
  it('parseSseEvents 把 event: thinking 作为独立事件类型透出', () => {
    const { events } = parseSseEvents('event: meta\ndata: {"qid":7}\n\nevent: thinking\ndata: {"secs":4,"chars":320}\n\ndata: {"d":"正"}\n\n');
    expect(events.map((e) => e.type)).toEqual(['meta', 'thinking', 'message']);
    expect(events[1].data).toEqual({ secs: 4, chars: 320 });
  });
});

describe('ask.vue / api.js 接线（源锁）', () => {
  it('streamExplain 三端都上送 question_id 并转发 onThinking', () => {
    expect(API).toMatch(/if \(questionId > 0\) fd\.append\('question_id', String\(questionId\)\)/);
    expect(API).toMatch(/\.\.\.\(questionId > 0 \? \{ question_id: questionId \} : \{\}\)/);
    expect(API).toMatch(/type === 'thinking'\) \{ onThinking && onThinking\(data\); \}/);
    expect((API.match(/, onMeta, onDelta, onThinking\);/g) || []).length).toBe(3);
  });
  it('ask 页传 questionId、按心跳更新 thinkSecs、流式卡占位用 thinkingText', () => {
    expect(ASK).toMatch(/questionId: qid,/);
    expect(ASK).toMatch(/onThinking: \(t\) => \{ live\.thinkSecs = thinkingSecs\(t\); \}/);
    expect(ASK).toMatch(/v-else-if="r\.streaming" class="spin">\{\{ thinkingText\(r\) \}\}/);
    expect(ASK).not.toMatch(/class="spin">生成中…<\/view>/);
  });
  it('R421b：「存入错题本」带 question_id（题库题深链 → 错题卡「AI 详解」再问才有 redoQid/「查看原题」）', () => {
    const save = ASK.slice(ASK.indexOf('async save(r)'), ASK.indexOf('async genSimilar('));
    expect(save).toMatch(/question_id: askQid\(r\.qid\) \|\| null,/);
  });
});
