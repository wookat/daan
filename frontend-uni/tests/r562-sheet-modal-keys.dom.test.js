// @vitest-environment jsdom
/* global KeyboardEvent, Element */
// R562：a11y-focus 弹层栈对 wd-popup（KgSheet 编译后 DOM）的真实行为——jsdom 里跑 initKeyboardFocus，
// 模拟 uni-h5 产物：<uni-view class="wd-popup-wrapper"><uni-view class="wd-transition wd-overlay"/><uni-view class="wd-transition kg-sheet wd-popup">…
// 关闭 = wot hideWhenClose → display:none（不是移除节点）。jsdom 无布局，getClientRects 用 display 链模拟。
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { initKeyboardFocus } from '../src/a11y-focus.js';

function shown(el) {
  for (let n = el; n && n.style; n = n.parentElement) if (n.style.display === 'none') return false;
  return el.isConnected;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function key(target, k, init = {}) {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
}

// 与 uni-h5 一致：交互元素为 uni-view 自定义元素，click 监听在 Vue runtime 挂上（a11y 补 tabindex）
function view(cls, onClick) {
  const v = document.createElement('uni-view');
  v.className = cls;
  if (onClick) v.addEventListener('click', onClick);
  return v;
}

function mountSheet({ title = '更多操作', modal = true } = {}) {
  const wrap = view('wd-popup-wrapper');
  const state = { open: false };
  const setOpen = (v) => {
    state.open = v;
    popup.style.display = v ? '' : 'none';
    if (overlay) overlay.style.display = v ? '' : 'none';
  };
  const overlay = modal ? view('wd-transition wd-overlay', () => setOpen(false)) : null;
  const popup = view('wd-transition kg-sheet wd-popup wd-popup--bottom');
  popup.style.zIndex = '1000';
  if (overlay) {
    overlay.style.zIndex = '1000';
    wrap.appendChild(overlay);
  }
  const inner = view('kg-sheet__in');
  inner.setAttribute('role', 'dialog');
  inner.setAttribute('aria-modal', 'true');
  inner.setAttribute('aria-label', title);
  const x = view('kg-sheet__x', () => setOpen(false));
  const act1 = view('more-act', () => {});
  const act2 = view('more-act cancel', () => setOpen(false));
  inner.append(x, act1, act2);
  popup.appendChild(inner);
  wrap.appendChild(popup);
  setOpen(false);
  document.body.appendChild(wrap);
  return { wrap, overlay, popup, x, act1, act2, state, setOpen };
}

beforeAll(() => {
  Element.prototype.getClientRects = function () {
    return shown(this) ? [{ width: 1, height: 1 }] : [];
  };
  initKeyboardFocus();
});

beforeEach(() => {
  document.body.innerHTML = '';
});

// 让 MutationObserver 回调在环境销毁前排空（否则 jsdom 卸载后回调里读 document 报未捕获错）
afterEach(async () => {
  document.body.innerHTML = '';
  await tick();
});

describe('KgSheet（wd-popup）进入 a11y 弹层栈', () => {
  it('打开：焦点从触发按钮移入弹层首个可聚焦项（关闭 X）；overlay/popup z-index 提到 --z-overlay 档 + 栈深', async () => {
    const trigger = view('more', () => {});
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    const s = mountSheet();
    await tick();
    s.setOpen(true);
    await tick();
    expect(document.activeElement).toBe(s.x);
    expect(s.popup.style.zIndex).toBe('1001');
    expect(s.overlay.style.zIndex).toBe('1001');
  });

  it('Tab / Shift+Tab 圈定在弹层内，不落到背景页控件', async () => {
    const bg = view('bg-btn', () => {});
    document.body.appendChild(bg);
    const s = mountSheet();
    await tick();
    s.setOpen(true);
    await tick();
    expect(document.activeElement).toBe(s.x);
    key(document.activeElement, 'Tab');
    expect(document.activeElement).toBe(s.act1);
    key(document.activeElement, 'Tab');
    expect(document.activeElement).toBe(s.act2);
    const e = key(document.activeElement, 'Tab');
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(s.x);
    key(document.activeElement, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(s.act2);
    expect(document.activeElement).not.toBe(bg);
  });

  it('Escape → 对同级 .wd-overlay 派发 click（= 用户点遮罩）→ 层关闭 → 焦点归还触发按钮', async () => {
    const trigger = view('more', () => {});
    document.body.appendChild(trigger);
    trigger.focus();
    const s = mountSheet();
    await tick();
    s.setOpen(true);
    await tick();
    // book.vue 页级 window keydown（≥1024 Escape 关 moreSheet）在冒泡阶段：栈已处理时不再收到，避免双关/误关下一层
    let pageSaw = 0;
    const pageKb = () => { pageSaw++; };
    window.addEventListener('keydown', pageKb);
    const e = key(document.activeElement, 'Escape');
    window.removeEventListener('keydown', pageKb);
    expect(e.defaultPrevented).toBe(true);
    expect(pageSaw).toBe(0);
    expect(s.state.open).toBe(false);
    expect(s.popup.style.display).toBe('none');
    await tick();
    expect(document.activeElement).toBe(trigger);
  });

  it('手录：触发项（fab 菜单「手录错题」v-if 随菜单收起）在层开着时被卸掉 → 关层后焦点归还 fab 主按钮而非 body（实测 FAIL 修复）', async () => {
    const fabmenu = view('fabmenu');
    const fabMain = view('fab-main', () => {});
    const item = view('kg-btn', () => {});
    fabmenu.append(item, fabMain);
    document.body.appendChild(fabmenu);
    const s = mountSheet({ title: '手录错题' });
    await tick();
    item.focus();
    expect(document.activeElement).toBe(item);
    s.setOpen(true);
    fabmenu.removeChild(item);
    await tick();
    expect(document.activeElement).toBe(s.x);
    key(document.activeElement, 'Escape');
    expect(s.state.open).toBe(false);
    await tick();
    expect(document.activeElement).toBe(fabMain);
  });

  it('IME 组合中的 Escape 不关层', async () => {
    const s = mountSheet();
    await tick();
    s.setOpen(true);
    await tick();
    const e = key(document.activeElement, 'Escape', { isComposing: true });
    expect(e.defaultPrevented).toBe(false);
    expect(s.state.open).toBe(true);
  });

  it('modal=false（无 overlay）的 popup：Tab 仍圈定，Escape 不吞键交回页面', async () => {
    const s = mountSheet({ modal: false });
    await tick();
    s.setOpen(true);
    await tick();
    expect(document.activeElement).toBe(s.x);
    const e = key(document.activeElement, 'Escape');
    expect(e.defaultPrevented).toBe(false);
    expect(s.state.open).toBe(true);
  });

  it('叠层：sheet 上再开 .mask 确认层 → 确认层 z=1002 压过 sheet，Esc 只关栈顶，再 Esc 关 sheet', async () => {
    const trigger = view('more', () => {});
    document.body.appendChild(trigger);
    trigger.focus();
    const s = mountSheet();
    await tick();
    s.setOpen(true);
    await tick();
    const mask = view('mask', () => mask.remove());
    const ok = view('ok', () => {});
    mask.appendChild(ok);
    document.body.appendChild(mask);
    await tick();
    expect(mask.style.zIndex).toBe('1002');
    expect(document.activeElement).toBe(ok);
    key(document.activeElement, 'Escape');
    expect(mask.isConnected).toBe(false);
    expect(s.state.open).toBe(true);
    await tick();
    expect(document.activeElement).toBe(s.x);
    key(document.activeElement, 'Escape');
    expect(s.state.open).toBe(false);
    await tick();
    expect(document.activeElement).toBe(trigger);
  });

  it('手录表单：无 tabindex 的原生 <textarea> 进入 Tab 序；disabled 控件跳过（实测两个 textarea 被 [tabindex] 选择器漏掉）', async () => {
    const s = mountSheet({ title: '手录错题' });
    const ta = document.createElement('textarea');
    const dis = document.createElement('input');
    dis.disabled = true;
    s.popup.querySelector('.kg-sheet__in').insertBefore(ta, s.act1);
    s.popup.querySelector('.kg-sheet__in').insertBefore(dis, s.act1);
    await tick();
    s.setOpen(true);
    await tick();
    expect(document.activeElement).toBe(s.x);
    key(document.activeElement, 'Tab');
    expect(document.activeElement).toBe(ta);
    key(document.activeElement, 'Tab');
    expect(document.activeElement).toBe(s.act1);
    key(document.activeElement, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(ta);
  });

  it('焦点在有内容的 textarea：首次 Escape 只退出控件（层不关、草稿保留），再 Escape 才关层；空 textarea 直接关', async () => {
    const s = mountSheet({ title: '手录错题' });
    const ta = document.createElement('textarea');
    s.popup.querySelector('.kg-sheet__in').insertBefore(ta, s.act1);
    await tick();
    s.setOpen(true);
    await tick();
    ta.value = '题干草稿';
    ta.focus();
    const e1 = key(ta, 'Escape');
    expect(e1.defaultPrevented).toBe(true);
    expect(s.state.open).toBe(true);
    expect(ta.value).toBe('题干草稿');
    expect(document.activeElement).not.toBe(ta);
    expect(s.popup.contains(document.activeElement)).toBe(true);
    key(document.activeElement, 'Escape');
    expect(s.state.open).toBe(false);
    await tick();
    s.setOpen(true);
    await tick();
    ta.value = '';
    ta.focus();
    key(ta, 'Escape');
    expect(s.state.open).toBe(false);
  });

  it('重开：同一 popup 节点 display:none → 再显示 视为新入栈（wot hideWhenClose 不删节点）', async () => {
    const s = mountSheet();
    await tick();
    s.setOpen(true);
    await tick();
    key(document.activeElement, 'Escape');
    await tick();
    s.setOpen(true);
    await tick();
    expect(document.activeElement).toBe(s.x);
    key(document.activeElement, 'Escape');
    expect(s.state.open).toBe(false);
  });
});
