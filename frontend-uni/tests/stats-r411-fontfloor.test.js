import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const stats = read('../src/pages/stats/stats.vue');
const book = read('../src/pages/book/book.vue');
const predict = read('../src/components/predict-card/predict-card.vue');

describe('R411 stats 字号下限 / 待掌握清零空态（源文件锁）', () => {
  it('stats.vue 样式无 <24rpx（375 下 12px）字号', () => {
    const style = stats.slice(stats.indexOf('<style'));
    const small = style.match(/font-size:\s*(?:[1-9]|1\d|2[0-3])rpx/g) || [];
    expect(small).toEqual([]);
    expect(style).not.toMatch(/font-size:\s*(?:[1-9]|1[01])(?:\.\d+)?px/);
  });
  it('predict-card（stats 内条件渲染，≥30 题后出现）样式同样无 <24rpx 字号', () => {
    const style = predict.slice(predict.indexOf('<style'));
    expect(style.match(/font-size:\s*(?:[1-9]|1\d|2[0-3])rpx/g) || []).toEqual([]);
  });
  it('待掌握 tab 全部掌握后（无搜索/筛选）有专属空态与「去刷题」', () => {
    expect(book).toMatch(/v-else-if="tab === 'todo' && !kw && !hasFilter"[\s\S]*?待掌握已清零[\s\S]*?doneItems\.length[\s\S]*?e-btn2/);
  });
});
