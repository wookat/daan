// R483：时政题（_sz）的 id 属于 shizheng_questions，与 questions.id 只是数字撞号——
// 错题快照与 answer_log 两条写入路径都必须置空 question_id/qid，否则服务端按题号的统计/去重/复习推进会算到同号行测题上
// （生产一手：answer_log 39 行撞号、19 道行测题统计被污染、真人 3 条时政错题套上资料分析选项）。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync(new URL('../src/pages/practice/practice.vue', import.meta.url), 'utf8');

describe('practice.vue 时政题号不入库', () => {
  it('错题写入四处 question_id 都带 _sz 守卫', () => {
    const guarded = SRC.match(/question_id: q\._sz \? null : q\.id \|\| null/g) || [];
    expect(guarded.length).toBe(4);
    expect(SRC).not.toMatch(/question_id: q\.id \|\| null/);
  });
  it('answer_log 条目 qid 带 _sz 守卫', () => {
    expect(SRC).toMatch(/qid: q\._sz \? null : q\.id \|\| null/);
    expect(SRC).not.toMatch(/qid: q\.id \|\| null/);
  });
});
