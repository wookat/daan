import { describe, it, expect } from 'vitest';
import { ICON_SIZES, ICON_TONES, isIconTone, resolveIconColor, iconSvgUri, iconMaskUri } from '../src/icon-tone';
import { MODULE_KEYS, moduleMeta, moduleLabel } from '../src/module-meta';

describe('l-icon tone/size（SPEC §2.9）', () => {
  it('尺寸只有 16/20/24/32', () => {
    expect(ICON_SIZES).toEqual([16, 20, 24, 32]);
  });

  it('tone 只接受语义名与 module:<key>', () => {
    expect(isIconTone('brand')).toBe(true);
    expect(isIconTone('on-brand')).toBe(true);
    expect(isIconTone('module:ziliao')).toBe(true);
    expect(isIconTone('module:nope')).toBe(false);
    expect(isIconTone('#2e5bff')).toBe(false);
    expect(isIconTone('red')).toBe(false);
  });

  it('tone 解析为 CSS 变量，无 tone 时回退 deprecated color，再回退 --ink-2', () => {
    expect(resolveIconColor('ok', '')).toBe('var(--ok)');
    expect(resolveIconColor('module:yanyu', '')).toBe('var(--mod-yanyu)');
    expect(resolveIconColor('', '#999')).toBe('#999');
    expect(resolveIconColor('', '')).toBe(ICON_TONES['ink-2']);
  });

  it('legacy 路径产 base64 SVG；tone 路径产 mask 用 URI（颜色由 background-color 决定）', () => {
    const body = '<path d="M1 1"/>';
    expect(iconSvgUri(body, { stroke: '#123456' })).toMatch(/^data:image\/svg\+xml;base64,/);
    const mask = iconMaskUri(body);
    expect(mask.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(mask)).toContain('stroke="#000"');
    expect(decodeURIComponent(mask)).toContain(body);
  });
});

describe('module-meta 生成物', () => {
  it('五模块齐全且颜色是 CSS 变量名', () => {
    expect(MODULE_KEYS).toEqual(['ziliao', 'shuliang', 'yanyu', 'panduan', 'changshi']);
    const m = moduleMeta('ziliao');
    expect(m.color).toBe('var(--mod-ziliao)');
    expect(m.soft).toBe('var(--mod-ziliao-soft)');
    expect(moduleLabel('yanyu')).toBe('言语理解');
    expect(moduleMeta('nope').soft).toBe('var(--brand-soft)'); // 未知 key 回退 brand，不抛错
  });
});
