// R423：面试点评流 thinking 心跳 → 报告页「考官正在撰写点评…」占位换成推理计时（首次点评与「重新生成点评」两条流同款）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { reviewThinkingLabel } from '../src/ask-link.js';

const VUE = readFileSync(new URL('../src/pkgA/interview/interview.vue', import.meta.url), 'utf8');
const API = readFileSync(new URL('../src/api.js', import.meta.url), 'utf8');

describe('reviewThinkingLabel', () => {
  it('未收到心跳保持原文案', () => {
    expect(reviewThinkingLabel(0)).toBe('考官正在撰写点评…');
    expect(reviewThinkingLabel(undefined)).toBe('考官正在撰写点评…');
    expect(reviewThinkingLabel(-3)).toBe('考官正在撰写点评…');
  });
  it('收到心跳后显示考官思考计时，20 s 起换「接近完成」', () => {
    expect(reviewThinkingLabel(1)).toBe('考官正在思考…（已 1 秒）');
    expect(reviewThinkingLabel(19)).toBe('考官正在思考…（已 19 秒）');
    expect(reviewThinkingLabel(20)).toMatch(/接近完成.*已 20 秒/);
    expect(reviewThinkingLabel(47.8)).toMatch(/已 47 秒/);
  });
});

describe('interview.vue / api.js 接线（源锁）', () => {
  it('两条面试流都把 onThinking 交给 feedSse', () => {
    const start = API.indexOf('export async function streamInterview(');
    const h5 = API.slice(start, API.indexOf('// #ifndef H5', start));
    expect(h5).toMatch(/streamInterview\(\{[^}]*onThinking/);
    expect(h5).toMatch(/streamInterviewReviewRegen\(\{[^}]*onThinking/);
    expect((h5.match(/feedSse\(dec\.decode\(value, \{ stream: true \}\), state, [^\n]*onDelta, onThinking\);/g) || []).length).toBe(2);
  });
  it('报告页占位读 loadingLabel，首次点评与重新生成都重置并更新 thinkSecs', () => {
    // W5 起占位 = kg-skeleton + <text class="loading-t">
    expect(VUE).toMatch(/class="loading" aria-busy="true">\s*<kg-skeleton preset="lines" \/>\s*<text class="loading-t">\{\{ loadingLabel \}\}<\/text>/);
    expect(VUE).toMatch(/loadingLabel\(\)\s*\{\s*return reviewThinkingLabel\(this\.thinkSecs\)/);
    expect((VUE.match(/onThinking: \(t\) => \{ this\.thinkSecs = thinkingSecs\(t\); \}/g) || []).length).toBe(2);
    expect((VUE.match(/this\.thinkSecs = 0;/g) || []).length).toBe(2);
  });
});
