// R574：小程序收藏页模块筛选 chips 只列本人有收藏的模块（与 H5 frontend-uni/src/fav-module-opts.js 同口径）：
// 深链 mod= 合法但当前 0 条 → 保留选项；只剩 1 个模块且筛选未排除任何收藏 → 行隐藏。render() 每次按全部 items 重算。
// 运行：cd miniapp-native && ../frontend-uni/node_modules/.bin/vitest run --config scripts/vitest.config.mts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { favModulePlan } from '../miniprogram/utils/fav-module-opts';

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const KEYS = ['ziliao', 'shuliang', 'yanyu', 'panduan', 'changshi', '时政'];
const label = (k: string) => 'L:' + k;
const vals = (p: { opts: { value: string }[] }) => p.opts.map((o) => o.value);

describe('favModulePlan', () => {
  it('只列有收藏的模块，按 keys 顺序', () => {
    const p = favModulePlan([{ module: 'changshi' }, { module: 'ziliao' }, { module: '时政' }], '', KEYS, label);
    expect(vals(p)).toEqual(['', 'ziliao', 'changshi', '时政']);
    expect(p.opts[1]).toEqual({ label: 'L:ziliao', value: 'ziliao' });
    expect(p.visible).toBe(true);
  });
  it('单模块 → 隐藏；单模块 + 选中同模块 → 仍隐藏', () => {
    expect(favModulePlan([{ module: 'panduan' }], '', KEYS, label)).toEqual({
      opts: [
        { label: '全部模块', value: '' },
        { label: 'L:panduan', value: 'panduan' },
      ],
      visible: false,
    });
    expect(favModulePlan([{ module: 'panduan' }], 'panduan', KEYS, label).visible).toBe(false);
  });
  it('选中模块当前 0 条 → 保留并可见；白名单外的 mod 不伪造选项但可见', () => {
    const p = favModulePlan([{ module: 'panduan' }], 'yanyu', KEYS, label);
    expect(vals(p)).toEqual(['', 'yanyu', 'panduan']);
    expect(p.visible).toBe(true);
    const q = favModulePlan([{ module: 'panduan' }], 'nope', KEYS, label);
    expect(vals(q)).toEqual(['', 'panduan']);
    expect(q.visible).toBe(true);
  });
  it('空列表 / module 为空 → 只剩全部，隐藏', () => {
    expect(favModulePlan([], '', KEYS, label).visible).toBe(false);
    expect(vals(favModulePlan([{ module: '' }, { module: null }], '', KEYS, label))).toEqual(['']);
  });
});

describe('pkgSocial/favorites 接线', () => {
  const TS = read('../miniprogram/pkgSocial/favorites/favorites.ts');
  const WXML = read('../miniprogram/pkgSocial/favorites/favorites.wxml');
  it('render() 按全部 items（非当前夹筛后）算 plan 并下发 modOpts/modChipsVisible', () => {
    expect(TS).toContain("import { favModulePlan } from '../../utils/fav-module-opts';");
    const i = TS.indexOf('render() {');
    const body = TS.slice(i, TS.indexOf('onTab(', i));
    expect(body).toContain('const plan = favModulePlan(this.items, modFilter, MOD_KEYS, modName);');
    expect(body.indexOf('const plan = favModulePlan(')).toBeLessThan(body.indexOf('if (folderId != null) list = list.filter('));
    expect(body).toContain('this.setData({ rows, curFolderName, modOpts: plan.opts, modChipsVisible: plan.visible });');
  });
  it('data 初值不再静态铺 6 个模块；WXML chip 行 wx:if', () => {
    expect(TS).toContain("modOpts: [{ label: '全部模块', value: '' }],");
    expect(TS).toContain('modChipsVisible: false,');
    expect(TS).not.toContain("...MOD_KEYS.map((m) => ({ label: modName(m), value: m }))");
    expect(WXML).toContain('<view wx:if="{{modChipsVisible}}" class="chips"><kg-chip-row options="{{modOpts}}" value="{{modFilter}}" bind:change="onModFilter" /></view>');
  });
});
