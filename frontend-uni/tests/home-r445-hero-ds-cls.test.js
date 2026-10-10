import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../src/pages/home/home.vue', import.meta.url)), 'utf8');
const template = src.slice(0, src.indexOf('<script'));

describe('R445 首页「今日全站同题」行首帧占位（源文件锁）', () => {
  it('.hero-ds 不以 dsMeta 为渲染条件：数据未回前该行已占位，回包后不下顶 hero 按钮与今日任务卡', () => {
    const lines = template.split('\n').filter((l) => l.includes('class="hero-ds"'));
    expect(lines).toHaveLength(2);
    expect(lines.some((l) => /v-if="dsMeta && dsDone"/.test(l))).toBe(true);
    const fallback = lines.find((l) => /\bv-else\b/.test(l));
    expect(fallback).toBeTruthy();
    expect(fallback).not.toMatch(/v-else-if/);
    expect(fallback).toMatch(/今日全站同题 10 题\{\{\s*dsMeta \?/);
  });
  it('每日一练选题按日哈希确定、题库非空即有 10 题（占位文案与后端口径一致）', () => {
    const db = readFileSync(fileURLToPath(new URL('../../backend/app/db_daily.py', import.meta.url)), 'utf8');
    expect(db).toMatch(/def daily_set_ids\(day: str\)/);
    expect(db).toMatch(/每模块 2 题共 10 题/);
    expect(db).toMatch(/pool\.sort\(key=lambda q: hashlib\.md5\(f"\{day\}:\{q\}"/);
  });
});
