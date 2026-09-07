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

// R484：AI 详解深链 / 「回看 AI 详解」按 qid 匹配，时政 id 同样会撞到同号行测题——
// ask 页会把该 qid 写进 rec.qid → 「查看原题」跳到别的题、「存入错题本」以 LLM 判出的行测模块落库绕过服务端 foreign_module_qid 兜底。
describe('practice.vue 时政题号不进 AI 详解深链', () => {
  it('deepExplain 的 redoQid 带 _sz 守卫', () => {
    expect(SRC).toMatch(/const qid = q\._sz \? 0 : askQid\(q\.id\);/);
  });
  it('curAskSeen 对时政题不按 id 匹配历史讲解', () => {
    expect(SRC).toMatch(/findAskSid\(.*this\.cur && !this\.cur\._sz && this\.cur\.id\);/);
  });
});
