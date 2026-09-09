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
    const { removed, kept } = reconcileStack([entry('a'), entry('b', false), entry('c', false)], present);
    expect(removed.map((e) => e.id)).toEqual(['c', 'b']);
    expect(kept.map((e) => e.id)).toEqual(['a']);
  });

  it('被压在开着的层下面消失（R563 更多操作层关 + uni-modal 开）：不进 removed（不抢顶层焦点），lastFocus 交给上面最近的存活层', () => {
    const a = { id: 'a', visible: false, lastFocus: ['fab'] };
    const b = { id: 'b', visible: true, lastFocus: ['del-item'] };
    const c = { id: 'c', visible: false, lastFocus: ['x'] };
    const { removed, buried, kept } = reconcileStack([a, b, c], present);
    expect(removed.map((e) => e.id)).toEqual(['c']);
    expect(buried.map((e) => e.id)).toEqual(['a']);
    expect(kept.map((e) => e.id)).toEqual(['b']);
    expect(kept[0].lastFocus).toEqual(['fab']);
  });

  it('中间层消失不影响上下层顺序；连续两层被压没时取最底层的 lastFocus', () => {
    const { removed, buried, kept } = reconcileStack([entry('a'), entry('b', false), entry('c')], present);
    expect(removed).toEqual([]);
    expect(buried.map((e) => e.id)).toEqual(['b']);
    expect(kept.map((e) => e.id)).toEqual(['a', 'c']);
    const r = reconcileStack(
      [{ id: 'a', visible: false, lastFocus: ['root'] }, { id: 'b', visible: false, lastFocus: ['mid'] }, entry('c')],
      present
    );
    expect(r.kept[0].lastFocus).toEqual(['root']);
  });

  it('空栈安全', () => {
    expect(reconcileStack([], present)).toEqual({ removed: [], buried: [], kept: [] });
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

// R563：uni-h5 原生层（uni.showModal / uni.showActionSheet）进栈的纯决策
import { modalEntry, modalKeyAction, nativeKind, initialFocusables, shouldSwallowKeyup, isTransitionLeaving, NATIVE_BTN_SEL } from '../src/modal-policy.js';

const tag = (tagName, cls = []) => ({ tagName, classList: { contains: (c) => cls.includes(c) } });

describe('R563 原生层条目', () => {
  it('nativeKind 只认两种宿主标签', () => {
    expect(nativeKind(tag('UNI-MODAL'))).toBe('uni-modal');
    expect(nativeKind(tag('UNI-ACTIONSHEET'))).toBe('uni-actionsheet');
    expect(nativeKind(tag('UNI-VIEW', ['wd-popup']))).toBe(null);
    expect(nativeKind(null)).toBe(null);
  });

  it('uni-modal：hit=null（Esc/Enter 交给 uni 自身 keyup，保持 Enter=确定），panel=.uni-modal，宿主提 z-index', () => {
    const host = tag('UNI-MODAL');
    const panel = {};
    expect(modalEntry(host, null, panel)).toEqual({ box: host, hit: null, layers: [host], panel, kind: 'uni-modal' });
    expect(modalEntry(host, null).panel).toBe(host);
  });

  it('uni-actionsheet：宿主不定位，hit=内部遮罩，遮罩+面板一起提 z-index（遮罩在下）', () => {
    const host = tag('UNI-ACTIONSHEET');
    const mask = {};
    const panel = {};
    expect(modalEntry(host, mask, panel)).toEqual({ box: host, hit: mask, layers: [mask, panel], panel, kind: 'uni-actionsheet' });
  });

  it('初始焦点：uni-modal 只取文本控件（无则落面板兜底，避免首个可聚焦「取消」把 Enter 变成取消）；其它层原样', () => {
    const ta = { tagName: 'TEXTAREA' };
    const btn = { tagName: 'DIV' };
    expect(initialFocusables('uni-modal', [ta, btn])).toEqual([ta]);
    expect(initialFocusables('uni-modal', [btn, btn])).toEqual([]);
    expect(initialFocusables(null, [btn])).toEqual([btn]);
    expect(initialFocusables('uni-actionsheet', [btn])).toEqual([btn]);
  });

  it('keyup 吞键：同键 + （按下期间入栈 gen 变化 或 keydown 已被消费）；异键/无 arm 不吞', () => {
    expect(shouldSwallowKeyup({ key: 'Enter', gen: 3, consumed: false }, 'Enter', 4)).toBe(true);
    expect(shouldSwallowKeyup({ key: 'Enter', gen: 3, consumed: false }, 'Enter', 3)).toBe(false);
    expect(shouldSwallowKeyup({ key: 'Escape', gen: 3, consumed: true }, 'Escape', 3)).toBe(true);
    expect(shouldSwallowKeyup({ key: 'Enter', gen: 3, consumed: true }, 'Escape', 4)).toBe(false);
    expect(shouldSwallowKeyup(null, 'Enter', 4)).toBe(false);
  });

  it('Enter/Space 在原生层 div 按钮上 → activate；不在按钮上 → null（Enter 留给 uni 确定）；Escape/Tab 优先级不变', () => {
    expect(modalKeyAction('Enter', false, false, true)).toBe('activate');
    expect(modalKeyAction(' ', false, false, true)).toBe('activate');
    expect(modalKeyAction('Enter', false, false, false)).toBe(null);
    expect(modalKeyAction('Escape', false, false, true)).toBe('dismiss');
    expect(modalKeyAction('Tab', false, false, true)).toBe('cycle');
    expect(modalKeyAction('Enter', true, false, true)).toBe(null);
  });

  it('uni-fade 离场类视为离场（uni 原生层 Transition name）', () => {
    expect(isTransitionLeaving('uni-fade-leave-active uni-fade-leave-to')).toBe(true);
    expect(isTransitionLeaving('uni-fade-enter-active')).toBe(false);
    expect(NATIVE_BTN_SEL).toBe('.uni-modal__btn, .uni-actionsheet__cell');
  });
});
