// R429：完成页「今日排行榜」请求带本人 uid——服务端榜只算真人（probe=0），带 uid 时本人成绩并入，
// 探针/走查会话提交后仍能在榜上看到自己（否则「我的名次：第 N 名」与空榜矛盾）。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync(new URL('../src/pages/practice/practice.vue', import.meta.url), 'utf8');

describe('practice.vue daily board', () => {
  it('/api/daily_set/board 带 encodeURIComponent(anonUid())', () => {
    const calls = SRC.match(/request\('\/api\/daily_set\/board.*?\)\.then/g) || [];
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("'/api/daily_set/board?uid=' + encodeURIComponent(anonUid())");
  });
});
