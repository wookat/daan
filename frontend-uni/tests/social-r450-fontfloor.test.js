import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const style = (src) => src.slice(src.indexOf('<style'));
const pages = {
  pk: read('../src/pkgA/pk/pk.vue'),
  pkResult: read('../src/pkgA/share/pk-result.vue'),
  shareQ: read('../src/pkgA/share/share-q.vue'),
  team: read('../src/pkgA/team/team.vue'),
};

describe('R450 分享 / PK / 小队排行字号下限与热区（源文件锁）', () => {
  for (const [name, src] of Object.entries(pages)) {
    it(`${name} 样式无 <24rpx（375 下 12px）字号`, () => {
      const css = style(src);
      expect(css.match(/font-size:\s*(?:[1-9]|1\d|2[0-3])rpx/g) || []).toEqual([]);
      expect(css).not.toMatch(/font-size:\s*(?:[1-9]|1[01])(?:\.\d+)?px/);
    });
  }
  it('小队「复制周战报」「提醒 TA」与 PK 模块 chip 纵向热区 ≥40px', () => {
    const team = style(pages.team);
    expect(team).toMatch(/\.rank-copy\s*\{[^}]*min-height:\s*40px;/);
    expect(team).toMatch(/\.remind-btn\s*\{[^}]*min-height:\s*40px;/);
    const pk = style(pages.pk);
    const chip = pk.match(/\.chip\s*\{([^}]*)\}/);
    expect(chip).toBeTruthy();
    expect(chip[1]).toMatch(/min-height:\s*40px;/);
    expect(chip[1]).toMatch(/display:\s*inline-flex;[^}]*align-items:\s*center;/);
  });
});
