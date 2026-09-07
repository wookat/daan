import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { planCardMark } from '../src/plan-days-label.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const home = read('../src/pages/home/home.vue');
const skel = read('../src/components/kg-skeleton/kg-skeleton.vue');

describe('首页学习计划卡占位（R508 CLS：cards 骨架 288px vs 引导卡 208/189、计划卡 507）', () => {
  it('骨架放在同一个 kg-card.sec.plan 里（同 padding/边框），用 plan 预设并按上次任务行数占位', () => {
    expect(home).toMatch(
      /<kg-card v-if="!profileFetched && planSkel" class="sec plan"><kg-skeleton preset="plan" :rows="planSkelRows" \/><\/kg-card>/,
    );
    expect(home).not.toMatch(/<kg-skeleton v-if="!profileFetched && planSkel" preset="cards"/);
    expect(home).toMatch(/^\s*planSkelRows: Number\(uni\.getStorageSync\('homePlanCard'\)\) \|\| 0,/m);
    expect(home.match(/uni\.setStorageSync\('homePlanCard', planCardMark\(this\.planToday\)\);/g)).toHaveLength(2);
    expect(home).not.toMatch(/setStorageSync\('homePlanCard', this\.planToday && this\.planToday\.profile \? '1' : ''\)/);
  });

  it('plan 预设：rows=0 → 头 68 + 两行说明 38 + 按钮 44；rows=n → 头 80 + 副标 19 + 进度 14 + n×62 + 主攻 30', () => {
    expect(skel).toMatch(/export const SKELETON_PRESETS = \[[^\]]*'plan'[^\]]*\];/);
    expect(skel).toMatch(/rows: \{ type: Number, default: 0 \},/);
    const block = skel.match(/<template v-else-if="preset === 'plan'">([\s\S]*?)<\/template>/);
    expect(block).not.toBeNull();
    const b = block[1];
    expect(b).toContain("height: rows ? '80px' : '68px'");
    expect(b).toContain("height: rows ? '19px' : '38px'");
    expect(b).toMatch(/<wd-skeleton v-if="rows"[^>]*height: '14px'/);
    expect(b).toMatch(/<wd-skeleton v-for="i in rows" :key="i"[^>]*height: '62px'/);
    expect(b).toContain("height: rows ? '30px' : '44px'");
  });

  it('专项练习模块列表占位仍用 cards 预设（不受影响）', () => {
    expect(home).toMatch(/<view v-if="!counts\.length" class="skelwrap" @click="loadCounts">\s*<kg-skeleton preset="cards" \/>/);
  });
});

describe('planCardMark（homePlanCard 本地标记存任务行数）', () => {
  it('无画像/无 plan_today → 空串（下次不占位、走引导卡判断）', () => {
    expect(planCardMark(null)).toBe('');
    expect(planCardMark(undefined)).toBe('');
    expect(planCardMark({ profile: null, tasks: [{}, {}] })).toBe('');
  });
  it('有画像 → 任务行数字符串；无任务数组/0 行兜底 "1"（真值兼容旧 "1" 标记）', () => {
    expect(planCardMark({ profile: { exam: 'guokao' }, tasks: [{}, {}, {}, {}] })).toBe('4');
    expect(planCardMark({ profile: { exam: 'guokao' }, tasks: [{}, {}, {}] })).toBe('3');
    expect(planCardMark({ profile: { exam: 'guokao' } })).toBe('1');
    expect(planCardMark({ profile: { exam: 'guokao' }, tasks: [] })).toBe('1');
    expect(Number('4') || 0).toBe(4);
    expect(Number('') || 0).toBe(0);
  });
});
