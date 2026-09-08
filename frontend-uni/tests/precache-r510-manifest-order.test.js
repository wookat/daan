import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { orderPrecache, PRECACHE_FIRST_ROUTES } from '../scripts/gen-precache-manifest.mjs';
import { PRECACHE_DELAY_MS } from '../src/precache.js';

// R510：运行期 precache 按清单顺序逐个 fetch，主循环页（练习/错题本）分包必须排在清单最前，
// 否则首页停留 8–12 s 内点进练习时仍有 ~30 个分包依赖走网络（生产一手：字母序清单爬不到 p）。
const FILES = [
  '/assets/a-first.js',
  '/assets/kg-button.js',
  '/assets/pages-book-book.js',
  '/assets/pages-home-home.js',
  '/assets/pages-practice-practice.js',
  '/assets/practice.css',
  '/assets/zzz-last.js'
];
const DEPS = {
  'pages/practice/practice': ['/assets/pages-practice-practice.js', '/assets/kg-button.js', '/assets/practice.css'],
  'pages/book/book': ['/assets/pages-book-book.js', '/assets/kg-button.js'],
  'pages/home/home': ['/assets/pages-home-home.js', '/assets/kg-button.js'],
  'pages/team/join': ['/assets/not-in-dist.js']
};

describe('gen-precache-manifest: 主循环页分包前置', () => {
  it('练习页依赖最前、错题本其次、首页随后，其余按原顺序补齐，不丢不重', () => {
    const out = orderPrecache(FILES, DEPS);
    expect(out.slice(0, 5)).toEqual([
      '/assets/pages-practice-practice.js',
      '/assets/kg-button.js',
      '/assets/practice.css',
      '/assets/pages-book-book.js',
      '/assets/pages-home-home.js'
    ]);
    expect(out.slice(5)).toEqual(['/assets/a-first.js', '/assets/zzz-last.js']);
    expect(new Set(out).size).toBe(FILES.length);
  });

  it('依赖表里不在产物中的路径不写入清单；无依赖表时退化为原顺序', () => {
    expect(orderPrecache(FILES, DEPS)).not.toContain('/assets/not-in-dist.js');
    expect(orderPrecache(FILES, {})).toEqual(FILES);
  });

  it('优先级以练习页开头、错题本第二', () => {
    expect(PRECACHE_FIRST_ROUTES.slice(0, 2)).toEqual(['pages/practice/practice', 'pages/book/book']);
  });
});

describe('precache.js: load 后延迟', () => {
  it('延迟 3 s：晚于首屏数据/题包预取，早于用户点进练习的最短间隔（生产非探针 ≥8 s）', () => {
    expect(PRECACHE_DELAY_MS).toBe(3000);
    const src = readFileSync(new URL('../src/precache.js', import.meta.url), 'utf8');
    expect(src).toMatch(/setTimeout\(\(\) => \{[\s\S]*?\}, PRECACHE_DELAY_MS\)/);
    expect(src).not.toMatch(/\}, 8000\)/);
  });
});
