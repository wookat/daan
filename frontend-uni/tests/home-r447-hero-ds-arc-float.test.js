import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../src/pages/home/home.vue', import.meta.url)), 'utf8');
const style = src.slice(src.indexOf('<style'));

describe('R447/R448 「补练往期 ›」右对齐（源文件锁）', () => {
  it('.hero-ds-arc 绝对定位贴右：文案回包变长时不水平漂移，也不会因放不下被挤到下一行压住 hero 按钮（R448）', () => {
    const rule = style.split('\n').find((l) => l.startsWith('.hero-ds-arc '));
    expect(rule).toBeTruthy();
    expect(rule).toMatch(/position:\s*absolute/);
    expect(rule).toMatch(/right:\s*-8rpx/);
    expect(rule).toMatch(/top:\s*50%/);
    expect(rule).toMatch(/translateY\(-50%\)/);
    expect(rule).not.toMatch(/float:/);
    expect(rule).not.toMatch(/display:\s*inline-block/);
    expect(rule).toMatch(/padding:\s*12px 8rpx/);
  });
  it('.hero-ds 为定位父级并用 padding-right 给链接留位：长文案（已完成 + 名次 + 连 N 天）在 375 下在链接左侧折行而不重叠', () => {
    const rule = style.split('\n').find((l) => l.startsWith('.hero-ds '));
    expect(rule).toBeTruthy();
    expect(rule).toMatch(/position:\s*relative/);
    // 「补练往期 ›」12px 字宽 56.6px + 4px 间距 → 预留 ≥ 61px（1rpx = 0.5px）
    const m = rule.match(/padding-right:\s*(\d+)rpx/);
    expect(m).toBeTruthy();
    expect(Number(m[1])).toBeGreaterThanOrEqual(122);
    expect(Number(m[1])).toBeLessThanOrEqual(140);
  });
});
