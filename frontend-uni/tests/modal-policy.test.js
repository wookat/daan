import { describe, it, expect } from 'vitest';
import { BASE_Z, reconcileStack, zIndexFor, pickFocusTarget, nextTabIndex } from '../src/modal-policy.js';

const entry = (id, visible = true) => ({ id, visible });
const present = (e) => e.visible;

describe('reconcileStack', () => {
  it('全部可见时栈保持原序不弹出', () => {
    const stack = [entry('a'), entry('b')];
    const { removed, kept } = reconcileStack(stack, present);
    expect(removed).toEqual([]);
    expect(kept.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('栈顶消失只弹出栈顶', () => {
    const { removed, kept } = reconcileStack([entry('a'), entry('b', false)], present);
    expect(removed.map((e) => e.id)).toEqual(['b']);
    expect(kept.map((e) => e.id)).toEqual(['a']);
  });

  it('多层同时消失按栈顶到栈底逆序弹出（焦点最终归还最底层的 lastFocus）', () => {
    const { removed, kept } = reconcileStack([entry('a', false), entry('b'), entry('c', false)], present);
    expect(removed.map((e) => e.id)).toEqual(['c', 'a']);
    expect(kept.map((e) => e.id)).toEqual(['b']);
  });

  it('中间层消失不影响上下层顺序', () => {
    const { removed, kept } = reconcileStack([entry('a'), entry('b', false), entry('c')], present);
    expect(removed.map((e) => e.id)).toEqual(['b']);
    expect(kept.map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('空栈安全', () => {
    expect(reconcileStack([], present)).toEqual({ removed: [], kept: [] });
  });
});

describe('zIndexFor', () => {
  it('以栈深单调递增，后开的层恒在先开的层之上', () => {
    expect(zIndexFor(1)).toBe(BASE_Z + 1);
    expect(zIndexFor(2)).toBeGreaterThan(zIndexFor(1));
    expect(zIndexFor(5)).toBe(BASE_Z + 5);
  });
});

describe('pickFocusTarget', () => {
  it('有可聚焦元素取首个且无需补 tabindex', () => {
    const a = {};
    const b = {};
    expect(pickFocusTarget([a, b], {})).toEqual({ el: a, needsTabindex: false });
  });

  it('空弹层落到 fallback 并补 tabindex=-1', () => {
    const fb = {};
    expect(pickFocusTarget([], fb)).toEqual({ el: fb, needsTabindex: true });
  });
});

describe('nextTabIndex', () => {
  it('前向循环：中间→下一个，末尾→回首', () => {
    expect(nextTabIndex(3, 0, false)).toBe(1);
    expect(nextTabIndex(3, 2, false)).toBe(0);
  });

  it('activeElement 不在列表内（-1）时前向落首、后向落尾', () => {
    expect(nextTabIndex(3, -1, false)).toBe(0);
    expect(nextTabIndex(3, -1, true)).toBe(2);
  });

  it('后向循环：中间→上一个，首个→回尾', () => {
    expect(nextTabIndex(3, 1, true)).toBe(0);
    expect(nextTabIndex(3, 0, true)).toBe(2);
  });

  it('单元素恒落自身', () => {
    expect(nextTabIndex(1, 0, false)).toBe(0);
    expect(nextTabIndex(1, 0, true)).toBe(0);
  });

  it('空列表返回 -1（调用方不移焦）', () => {
    expect(nextTabIndex(0, -1, false)).toBe(-1);
    expect(nextTabIndex(0, -1, true)).toBe(-1);
  });
});
