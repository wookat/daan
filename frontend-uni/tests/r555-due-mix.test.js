// R555：普通练习混入到期错题。研究一手核实：`/api/questions` 的 random_questions 按 uid 排除答过的题 → 普通练习
// 永远抽不到自己的错题，服务端 R371「答对曾错题 via=answer 推进复习」在普通练习里结构性不可达（生产近 30 天
// review_log 35 行全 via=NULL、71 个有未掌握错题的用户仅 6 个有复习记录）。H5 侧接线：
// ① start()/prefetchNextGroup 带 uid 时加 `mix_due=1`（服务端在 real/tag3/adaptive 下忽略，不改其他调用方）；
// ② 卡面 kg-question-card 对 `due_mid` 题显「曾错题 · 到期复习」；③ answer_log 以 `mid: due_mid` 上送让推进精确到该错题。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const PRACTICE = readFileSync(join(SRC, 'pages/practice/practice.vue'), 'utf8');
const CARD = readFileSync(join(SRC, 'components/kg-question-card/kg-question-card.vue'), 'utf8');

describe('R555 普通练习混入到期错题（H5）', () => {
  it('start() 主请求与放宽回退带 mix_due=1，且只在有 uid 时', () => {
    expect(PRACTICE).toMatch(/const mixQ = uid \? '&mix_due=1' : '';/);
    expect(PRACTICE).toMatch(/'\/api\/questions\?limit=' \+ limit \+ realQ \+ uidQ \+ mixQ \+ adQ \+ grpQ \+ tagQ \+/);
    expect(PRACTICE).toMatch(/'\/api\/questions\?limit=' \+ limit \+ realQ \+ uidQ \+ mixQ \+ \(module \? '&module=' \+ module : ''\)/);
    expect(PRACTICE).toMatch(/'\/api\/questions\?limit=' \+ limit \+ uidQ \+ mixQ \+ \(module \? '&module=' \+ module : ''\)/);
  });
  it('中场预取下一组同样带 mix_due=1（「再来一组」命中预取包时口径一致）', () => {
    expect(PRACTICE).toMatch(/prefetchNextGroup\(\) \{[\s\S]*?'&uid=' \+ encodeURIComponent\(uid\) \+ '&mix_due=1'/);
  });
  it('强化练习（mode=reinforce）与错题重练（/api/mistakes/redo）不带 mix_due', () => {
    const at = PRACTICE.indexOf("'/api/questions?mode=reinforce&limit=' + (launch.count || 5) +");
    expect(at).toBeGreaterThan(0);
    expect(PRACTICE.slice(at, at + 300)).not.toMatch(/mix_due/);
    expect(PRACTICE).not.toMatch(/mistakes\/redo[^\n]*mix_due/);
  });
  it('卡面：qCard 透传 dueMix，kg-question-card 显「曾错题 · 到期复习」', () => {
    expect(PRACTICE).toMatch(/isReal: !!q\.is_real,\n\s+dueMix: !!q\.due_mid,/);
    expect(CARD).toMatch(/<kg-tag v-if="q\.dueMix" tone="info">曾错题 · 到期复习<\/kg-tag>/);
  });
  it('answer_log 以 due_mid 作 mid 上送；完成页重练效果统计仍只看 mistake_id（混入题不算 redo）', () => {
    expect(PRACTICE).toMatch(/mid: q\.mistake_id \|\| q\.due_mid \|\| undefined,/);
    expect(PRACTICE).toMatch(/const answered = this\.items\.filter\(\(q\) => q\._picked && q\.mistake_id\);/);
  });
});
