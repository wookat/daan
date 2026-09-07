import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// R497：提醒设置页「提醒时间 20:30 ›」的可点区就是 <picker> 包住的 .time-v 本体
// （行本身不可点），改前生产 375/1440 量得 53×16px，低于 #619 既定 40px 命中下限。
const src = readFileSync(new URL('../src/pkgA/settings/reminders.vue', import.meta.url), 'utf8');
const css = src.slice(src.indexOf('<style'));
const rule = (sel) => (css.match(new RegExp(`\\n\\s*${sel.replace(/[.:]/g, '\\$&')} \\{([^}]*)\\}`)) || [])[1] || '';

describe('R497 提醒设置页 picker 触发区热区（源文件锁）', () => {
  it('.time-v 仍是 <picker mode="time"> 的唯一子元素（可点区 = .time-v 本体）', () => {
    expect(src).toMatch(/<picker mode="time"[^>]*>\s*<view class="time-v">/);
  });

  it('.time-v 命中高 ≥40px（px 不用 rpx）且纵向居中，不改字号', () => {
    const r = rule('.time-v');
    expect(r).not.toBe('');
    expect(r).toMatch(/min-height:\s*40px/);
    expect(r).not.toMatch(/min-height:\s*\d+rpx/);
    expect(r).toMatch(/display:\s*inline-flex/);
    expect(r).toMatch(/align-items:\s*center/);
    expect(r).toMatch(/font-size:\s*27rpx/);
  });

  it('.set-row 行高仍 ≥56px（.time-v 40px 不撑破行）', () => {
    expect(rule('.set-row')).toMatch(/min-height:\s*56px/);
  });
});
