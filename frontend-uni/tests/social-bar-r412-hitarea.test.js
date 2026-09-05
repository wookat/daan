import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../src/components/q-social-bar/q-social-bar.vue', import.meta.url)), 'utf8');
const rule = (name) => (src.match(new RegExp(`\\n\\.${name} \\{([^}]*)\\}`)) || [])[1] || '';

describe('R412 社交栏文字链热区（源文件锁）', () => {
  it('写笔记/讨论/分享 与 笔记操作 文字链 min-height 40px，字号 ≥24rpx', () => {
    for (const n of ['qsb-link', 'nop']) {
      expect(rule(n)).toMatch(/min-height:\s*40px/);
      expect(rule(n)).toMatch(/display:\s*inline-flex/);
    }
    expect(rule('edit')).toMatch(/padding:\s*8px/);
    expect(src.slice(src.indexOf('<style'))).not.toMatch(/font-size:\s*(?:1\d|2[0-3])rpx/);
  });
});
