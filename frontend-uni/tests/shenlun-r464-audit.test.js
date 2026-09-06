import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../src/pkgA/shenlun/shenlun.vue', import.meta.url)), 'utf8');
const style = src.slice(src.indexOf('<style'));
const rule = (sel) => (style.match(new RegExp(`\\n${sel.replace(/[.:]/g, '\\$&')} \\{([^}]*)\\}`)) || [])[1] || '';

describe('R464 申论页字号下限 / 可点元素热区（源文件锁）', () => {
  it('样式块内无 <24rpx 字号（375 下 <12px）', () => {
    expect(style).not.toMatch(/font-size:\s*(?:1\d|2[0-3])rpx/);
  });

  it('页签 / 筛选 chip / 抽屉 chip / 去作答 / 返回 / 上下题 / 折叠标题 / 复制链接 / 重试 命中高 ≥40px', () => {
    for (const sel of ['.seg-i', '.chip', '.q-go', '.back', '.d-nav-btn', '.d-h.toggle', '.d-copy', '.retry', '.sheet-x', '.grade-btn']) {
      expect(rule(sel), sel).toMatch(/min-height:\s*40px/);
    }
    expect(rule('.chip.sm')).not.toMatch(/min-height|font-size/);
  });

  it('套卷标签「只看本套卷」保留 20px 视觉，用 ::after 撑 40px 命中区', () => {
    expect(rule('.q-paper.tappable')).toMatch(/position:\s*relative/);
    const after = rule('.q-paper.tappable::after');
    expect(after).toMatch(/position:\s*absolute/);
    expect(after).toMatch(/height:\s*40px/);
    expect(after).toMatch(/top:\s*50%/);
    expect(after).toMatch(/translateY\(-50%\)/);
  });

  it('筛选 ✕ 是 40×40 且用负外边距不抬高标题行', () => {
    expect(rule('.sheet-x')).toMatch(/min-width:\s*40px/);
    expect(rule('.sheet-x')).toMatch(/margin:\s*-6px/);
  });
});
