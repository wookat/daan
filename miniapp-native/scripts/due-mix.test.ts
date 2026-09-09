// R555：小程序普通练习混入到期错题，与 H5 practice.vue 同口径——drawQuestions 非强化模式带 mix_due=1
// （服务端在 real/tag3/adaptive 下忽略），卡面对 due_mid 题显「曾错题 · 到期复习」，answer_log 以 due_mid 作 mid 上送。
// 运行：cd miniapp-native && ../frontend-uni/node_modules/.bin/vitest run --config scripts/vitest.config.mts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

describe('R555 普通练习混入到期错题（小程序）', () => {
  const learn = read('../miniprogram/api/learn.ts');
  const ts = read('../miniprogram/pages/practice/practice.ts');
  const wxml = read('../miniprogram/pages/practice/practice.wxml');
  const types = read('../miniprogram/api/types.ts');

  it('drawQuestions: mixDue → &mix_due=1', () => {
    expect(learn).toMatch(/mixDue\?: boolean;/);
    expect(learn).toMatch(/if \(p\.mixDue\) q \+= '&mix_due=1';/);
  });
  it('practice.start: 普通/真题/考点抽题带 mixDue（非 reinforce），真题回退题库同样带；redo/redoset 不经 drawQuestions', () => {
    expect(ts).toMatch(/mode: args\.mode === 'reinforce' \? \('reinforce' as const\) : \('' as const\),\n\s+mixDue: args\.mode !== 'reinforce',/);
    expect(ts).toMatch(/d = await drawQuestions\(\{ limit, module: args\.module, mixDue: true \}\);/);
    expect(ts).toMatch(/if \(args\.mode === 'redo'\) \{\n\s+d = await redoMistakesFiltered/);
  });
  it('卡面 tagrow 显「曾错题 · 到期复习」；Question 类型带 due_mid/due_streak', () => {
    expect(wxml).toMatch(/<kg-tag wx:if="\{\{cur\.due_mid\}\}" tone="info">曾错题 · 到期复习<\/kg-tag>/);
    expect(types).toMatch(/due_mid\?: number;\n\s+due_streak\?: number;/);
  });
  it('answer_log mid 取 mistake_id 其次 due_mid', () => {
    expect(ts).toMatch(/mid: q\.mistake_id \|\| q\.due_mid \|\| undefined,/);
  });
});
