import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../src/pages/practice/practice.vue', import.meta.url)), 'utf8');
const style = src.slice(src.indexOf('<style'));
const rule = (sel) => (style.match(new RegExp(`\\n${sel.replace(/[.:]/g, '\\$&')} \\{([^}]*)\\}`)) || [])[1] || '';

describe('R465 作答页字号下限 / 可点元素热区（源文件锁）', () => {
  it('样式块内无 <24rpx 字号（375 下 <12px）', () => {
    expect(style).not.toMatch(/font-size:\s*(?:1\d|2[0-3])rpx/);
  });

  it('答题卡入口 .tag 是 40px 热区 + 负外边距不抬 header 行；文字/省略号在 .tag-t', () => {
    expect(src).toMatch(/<view class="tag" role="button" @click="cardOpen = true"><text class="tag-t">/);
    expect(rule('.tag')).toMatch(/min-height:\s*40px/);
    expect(rule('.tag')).toMatch(/margin:\s*-10px 0/);
    expect(rule('.tag')).not.toMatch(/overflow/);
    expect(rule('.tag-t')).toMatch(/text-overflow:\s*ellipsis/);
    expect(rule('.tag-t')).toMatch(/font-size:\s*24rpx/);
  });

  it('header 退出 / 工具 ··· / 关闭 ✕ / 提示 ✕ / 有用·有误 / 纠错 / 详解 / 举报类型 / 强化 / 回错题本 / 去复习·去登录·开启 / 材料折叠 命中高 ≥40px', () => {
    for (const sel of ['.op', '.sheet-x', '.loginnudge-x', '.hs-rate-btn', '.report-link', '.deep', '.rp-chip', '.wr-btn', '.rr-go', '.duenudge-go', '.mat-fold', '.fixreport']) {
      expect(rule(sel), sel).toMatch(/min-height:\s*40px/);
    }
    expect(rule('.lead-x')).toMatch(/width:\s*40px; height:\s*40px/);
    expect(rule('.fontbtn::after')).toMatch(/inset:\s*-12px/);
  });

  it('✕ 与 header 内文字链用负外边距，不抬标题行高', () => {
    for (const sel of ['.sheet-x', '.loginnudge-x']) expect(rule(sel), sel).toMatch(/margin:\s*-6px/);
    expect(rule('.op')).toMatch(/margin:\s*-10px/);
  });
});
