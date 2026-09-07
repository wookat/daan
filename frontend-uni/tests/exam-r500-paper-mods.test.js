// R500：卷卡如实外显模块构成/缺项（回忆版真题卷多缺资料分析），纯函数 + 卷库页源文件锁
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { paperModsText } from '../src/exam-paper-mods.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

describe('paperModsText', () => {
  it('五模块齐全：按标准顺序拼接，不带「缺」', () => {
    expect(paperModsText({ ziliao: 20, changshi: 20, panduan: 40, yanyu: 40, shuliang: 15 }))
      .toBe('常识 20 · 言语 40 · 数量 15 · 判断 40 · 资料 20');
  });

  it('回忆版卷缺资料分析：末尾如实标「缺资料」', () => {
    expect(paperModsText({ changshi: 31, yanyu: 24, shuliang: 5, panduan: 21 }))
      .toBe('常识 31 · 言语 24 · 数量 5 · 判断 21 · 缺资料');
  });

  it('多个缺项用 / 连接；0 / 负数 / 非整数计数视为缺', () => {
    expect(paperModsText({ yanyu: 30, panduan: 30, ziliao: 0, shuliang: -1, changshi: 1.5 }))
      .toBe('言语 30 · 判断 30 · 缺常识/数量/资料');
  });

  it('fail-closed：非对象 / 空对象 / 全 0 / 未知键 → 空串不渲染', () => {
    expect(paperModsText(undefined)).toBe('');
    expect(paperModsText(null)).toBe('');
    expect(paperModsText('changshi')).toBe('');
    expect(paperModsText({})).toBe('');
    expect(paperModsText({ changshi: 0, yanyu: 0 })).toBe('');
    expect(paperModsText({ shenlun: 5 })).toBe('');
  });
});

describe('卷库页 list.vue 源文件锁', () => {
  const src = read('../src/pkgA/exam/list.vue');
  it('卷卡渲染 .pmods（v-if 空串不渲染），数据走 paperModsText(p.mods)', () => {
    expect(src).toMatch(/<text v-if="modsText\(p\)" class="pmods">\{\{ modsText\(p\) \}\}<\/text>/);
    expect(src).toMatch(/import \{ paperModsText \} from '\.\.\/\.\.\/exam-paper-mods\.js'/);
    expect(src).toMatch(/return paperModsText\(p && p\.mods\)/);
  });
  it('.pmods 字号 ≥24rpx 且整行独占（R470 字号下限口径）', () => {
    const css = src.slice(src.indexOf('<style'));
    const rule = (css.match(/\n\s*\.pmods \{([^}]*)\}/) || [])[1] || '';
    // W5 token：--fs-sub = 13px（> 24rpx@375 = 12px 下限）
    expect(rule).toMatch(/font-size:\s*(?:24rpx|var\(--fs-sub\)|var\(--fs-caption\))/);
    expect(rule).toMatch(/display:\s*block/);
    expect(rule).toMatch(/width:\s*100%/);
  });
});
