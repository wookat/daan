import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../src/pages/home/home.vue', import.meta.url)), 'utf8');
const style = src.slice(src.indexOf('<style'));

describe('R447 「补练往期 ›」右浮动（源文件锁）', () => {
  it('.hero-ds-arc 右浮动：参与人数文案回包变长时链接位置不随文字水平漂移', () => {
    const rule = style.split('\n').find((l) => l.startsWith('.hero-ds-arc '));
    expect(rule).toBeTruthy();
    expect(rule).toMatch(/float:\s*right/);
    expect(rule).not.toMatch(/display:\s*inline-block/);
    // 热区仍靠负外边距 + 内边距撑出，且右侧负外边距让文字与 hero 内容右缘对齐
    expect(rule).toMatch(/margin:\s*-12px -8rpx -12px 8rpx/);
    expect(rule).toMatch(/padding:\s*12px 8rpx/);
  });
});
