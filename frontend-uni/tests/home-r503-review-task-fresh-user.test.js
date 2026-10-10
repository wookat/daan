import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../src/pages/home/home.vue', import.meta.url)), 'utf8');
const template = src.slice(0, src.indexOf('<script'));
const script = src.slice(src.indexOf('<script'), src.indexOf('</script>'));

// R503 命中：从未有过错题的新用户，旧「今日任务 x/3」卡把「没有错题可复习」当成「复习已清零 ✓」计 1/3。
// W5/main 起首页「今日任务」卡已并入「学习计划」三态卡：无画像时只在 due_mistakes>0 才渲染复习行，
// 不再有「今日已清零」文案与 ✓ 计数 → 缺陷面消失；本锁改为锁住这一等价语义，防止回退。
describe('R503 首页「错题复习」：从未有过错题的新用户不得被标成「今日已清零 ✓」（源文件锁）', () => {
  it('首页不再有「今日已清零」/ 任务计数式复习 ✓；复习行只在 due_mistakes>0 时渲染', () => {
    expect(template).not.toMatch(/今日已清零/);
    expect(template).not.toMatch(/planFetched && !dueReview/);
    // P1 改版：独立「到期复习」卡并入「今日待办」智能卡 todoRows——复习行只在 dueReview>0 时入列，语义等价
    expect(script).toMatch(/if \(this\.dueReview\) \{\s*rows\.push\(\{ k: 'review'/);
    expect(template).toMatch(/v-for="t in todoRows" :key="t\.k" class="todo-row"/);
    expect(template).toMatch(/<view v-if="plan\.due_mistakes" class="task" role="button" hover-class="task--hover" @click="goBook">/);
    expect(script).toMatch(/dueReview\(\) \{\s*return \(this\.plan && this\.plan\.due_mistakes\) \|\| 0;/);
    expect(script).not.toMatch(/reviewTaskDone|taskDoneN/);
  });
  it('已制定计划态：任务行的 done 由服务端 plan_today.tasks[].done 决定，前端不自行判定复习完成', () => {
    expect(template).toMatch(/v-for="t in planToday\.tasks" :key="t\.key" class="task" :class="\{ 'is-done': t\.done \}"/);
    const plan = readFileSync(fileURLToPath(new URL('../../backend/app/plan.py', import.meta.url)), 'utf8');
    // 服务端只在 review_target>0（有到期/新错题）时才追加复习任务，无错题用户不会出现复习任务
    expect(plan).toMatch(/if review_target > 0:\s*tasks\.append\(\{\s*"key": "review"/);
  });
  it('后端 daily_plan 返回 mistakes_total（按 uid 隔离、含已掌握；小程序端/兼容口径保留）', () => {
    const db = readFileSync(fileURLToPath(new URL('../../backend/app/db_stats.py', import.meta.url)), 'utf8');
    const fn = db.slice(db.indexOf('def daily_plan('), db.indexOf('def stats('));
    expect(fn).toMatch(/SELECT COUNT\(\*\) n FROM mistakes WHERE 1=1\{uc\}/);
    expect(fn).toMatch(/"mistakes_total": mtotal\["n"\]/);
  });
});
