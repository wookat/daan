import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../src/pages/home/home.vue', import.meta.url)), 'utf8');
const template = src.slice(0, src.indexOf('<script'));
const script = src.slice(src.indexOf('<script'), src.indexOf('</script>'));

function reviewTaskDone(planFetched, plan) {
  const dueReview = (plan && plan.due_mistakes) || 0;
  if (!planFetched || dueReview) return false;
  const t = plan && plan.mistakes_total;
  return t == null || t > 0;
}

describe('R503 首页「错题复习」任务：从未有过错题的新用户不算「今日已清零 ✓」（源文件锁）', () => {
  it('模板三处（✓ / 名称 done / 计数）都走 reviewTaskDone，而不是裸 planFetched && !dueReview', () => {
    const row = template.slice(template.indexOf("taskGo('review')"), template.indexOf("taskGo('checkin')"));
    expect(row).toMatch(/class="tk-ck" :class="\{ on: reviewTaskDone \}"/);
    expect(row).toMatch(/class="tk-name" :class="\{ done: reviewTaskDone \}"/);
    expect(row).not.toMatch(/planFetched && !dueReview/);
    expect(row).toMatch(/reviewTaskDone \? '今日已清零' : planFetched \? '答错的题自动进错题本' : '按遗忘曲线安排'/);
    expect(script).toMatch(/taskDoneN\(\) \{[\s\S]*?if \(this\.reviewTaskDone\) n\+\+;/);
    expect(script).not.toMatch(/if \(this\.planFetched && !this\.dueReview\) n\+\+/);
  });
  it('reviewTaskDone：有 mistakes_total 字段时 0 → false；>0 且无到期 → true；老快照无字段沿用旧口径', () => {
    expect(script).toMatch(/reviewTaskDone\(\) \{[\s\S]*?const t = this\.plan && this\.plan\.mistakes_total;\s*return t == null \|\| t > 0;/);
    expect(reviewTaskDone(false, null)).toBe(false);
    expect(reviewTaskDone(true, { due_mistakes: 0, mistakes_total: 0 })).toBe(false);
    expect(reviewTaskDone(true, { due_mistakes: 0, mistakes_total: 3 })).toBe(true);
    expect(reviewTaskDone(true, { due_mistakes: 2, mistakes_total: 3 })).toBe(false);
    expect(reviewTaskDone(true, { due_mistakes: 0 })).toBe(true);
  });
  it('后端 daily_plan 返回 mistakes_total（按 uid 隔离、含已掌握）', () => {
    const db = readFileSync(fileURLToPath(new URL('../../backend/app/db.py', import.meta.url)), 'utf8');
    const fn = db.slice(db.indexOf('def daily_plan('), db.indexOf('def question_attempts('));
    expect(fn).toMatch(/SELECT COUNT\(\*\) n FROM mistakes WHERE 1=1\{uc\}/);
    expect(fn).toMatch(/"mistakes_total": mtotal\["n"\]/);
  });
});
