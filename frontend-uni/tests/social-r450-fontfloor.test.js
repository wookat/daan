import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { legacyHit, assertHitLayer } from './_w5-hit.js';

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
  it('小队「复制周战报」「提醒 TA」是 kg-button sm、PK 模块 chip 是 kg-chip-row：命中由组件层 --hit-min 保证', () => {
    assertHitLayer(expect);
    expect(pages.team).toMatch(/<kg-button variant="text" size="sm" icon="copy" @click="copyWeekReport">复制周战报<\/kg-button>/);
    expect(pages.team).toMatch(/<kg-button v-if="!m\.is_me && !m\.today_n" variant="secondary" size="sm" icon="bell" @click="remind\(m\)">提醒 TA<\/kg-button>/);
    expect(pages.pk).toMatch(/<kg-chip-row :options="modOpts" :model-value="module \|\| ''"/);
    for (const s of ['.rank-copy', '.remind-btn']) expect(legacyHit(expect, pages.team, s), s).toBe('componentized');
    expect(legacyHit(expect, pages.pk, '.chip')).toBe('componentized');
  });
});
