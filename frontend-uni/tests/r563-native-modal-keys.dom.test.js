// @vitest-environment jsdom
/* global KeyboardEvent, Element */
// R563：uni-h5 原生 API 层（uni.showModal → <uni-modal>、uni.showActionSheet → <uni-actionsheet>）进入 a11y-focus 弹层栈。
// 模拟 uni-h5 产物 DOM（见 node_modules/@dcloudio/uni-h5/dist/uni-h5.es.js modal/actionSheet render）与它的键盘实现：
// usePopup → useKeyboard 在 document 'keyup' 上判 Esc→cancel / Enter→confirm（非 editable），visible=false 时 disable。
// 本地实测（本 R563 研究，本地 dist + Chromium）：更多操作层 Tab 到「删除」按 Enter → keydown 激活开确认框 → 同一次 keyup 被
// uni 当「确定」→ DELETE 直发、确认框一闪即过；Space/鼠标无此问题。
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { initKeyboardFocus } from '../src/a11y-focus.js';

function shown(el) {
  for (let n = el; n && n.style; n = n.parentElement) if (n.style.display === 'none') return false;
  return el.isConnected;
}
const tick = () => new Promise((r) => setTimeout(r, 0));

function kd(target, k, init = {}) {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
}
function ku(target, k) {
  const e = new KeyboardEvent('keyup', { key: k, bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
}
// 一次完整按键：keydown（同步）→ 任务边界（MutationObserver 排空）→ keyup
async function press(k, init) {
  const t = document.activeElement || document.body;
  const e = kd(t, k, init);
  await tick();
  ku(document.activeElement || document.body, k);
  await tick();
  return e;
}

function view(cls, onClick) {
  const v = document.createElement('uni-view');
  v.className = cls;
  if (onClick) v.addEventListener('click', onClick);
  return v;
}
function div(cls, text, onClick) {
  const d = document.createElement('div');
  d.className = cls;
  if (text) d.textContent = text;
  if (onClick) d.addEventListener('click', onClick);
  return d;
}

// uni.showModal 仿真：单例 #u-a-m 根，v-show 在 <uni-modal> 宿主上；keyup 监听与 uni 同（document、非捕获）
function uniModalSim() {
  const log = [];
  const root = document.createElement('div');
  root.id = 'u-a-m';
  const host = document.createElement('uni-modal');
  host.style.display = 'none';
  const state = { visible: false, editable: false, resolve: null };
  const close = (res) => {
    state.visible = false;
    host.style.display = 'none';
    log.push(res);
    if (state.resolve) state.resolve(res);
  };
  const cancel = () => close('cancel');
  const confirm = () => close('confirm');
  const mask = div('uni-mask');
  const panel = div('uni-modal');
  const hd = div('uni-modal__hd');
  const title = document.createElement('strong');
  title.className = 'uni-modal__title';
  hd.appendChild(title);
  const bd = div('uni-modal__bd');
  const ft = div('uni-modal__ft');
  const btnCancel = div('uni-modal__btn uni-modal__btn_default', '取消', cancel);
  const btnOk = div('uni-modal__btn uni-modal__btn_primary', '确定', confirm);
  ft.append(btnCancel, btnOk);
  panel.append(hd, bd, ft);
  host.append(mask, panel);
  root.appendChild(host);
  document.body.appendChild(root);
  document.addEventListener('keyup', (e) => {
    if (!state.visible) return;
    if (e.key === 'Escape' || e.key === 'Esc') cancel();
    else if (e.key === 'Enter' && !state.editable) confirm();
  });
  const showModal = ({ title: t, content, confirmText = '确定', showCancel = true, editable = false }) =>
    new Promise((resolve) => {
      title.textContent = t || '';
      bd.textContent = content || '';
      btnOk.textContent = confirmText;
      btnCancel.style.display = showCancel ? '' : 'none';
      state.editable = editable;
      state.resolve = resolve;
      let ta = panel.querySelector('textarea');
      if (editable && !ta) {
        ta = document.createElement('textarea');
        ta.className = 'uni-modal__textarea';
        panel.insertBefore(ta, ft);
      } else if (!editable && ta) ta.remove();
      state.visible = true;
      host.style.display = '';
    });
  return { host, panel, title, bd, btnCancel, btnOk, showModal, log, state };
}

// uni.showActionSheet 仿真：宿主常驻，遮罩 v-show + 面板 _toggle 类
function uniActionSheetSim(items) {
  const log = [];
  const host = document.createElement('uni-actionsheet');
  const mask = div('uni-mask uni-actionsheet__mask', '', () => close(-1));
  mask.style.display = 'none';
  const panel = div('uni-actionsheet');
  const menu = div('uni-actionsheet__menu');
  const ph = div('uni-actionsheet__cell');
  const title = div('uni-actionsheet__title', '选择');
  menu.append(ph, title);
  const cells = items.map((t, i) => div('uni-actionsheet__cell', t, () => close(i)));
  menu.append(...cells);
  const act = div('uni-actionsheet__action');
  const cancelCell = div('uni-actionsheet__cell', '取消', () => close(-1));
  act.appendChild(cancelCell);
  panel.append(menu, act);
  host.append(mask, panel);
  function close(i) {
    log.push(i);
    mask.style.display = 'none';
    panel.classList.remove('uni-actionsheet_toggle');
  }
  const show = () => {
    mask.style.display = '';
    panel.classList.add('uni-actionsheet_toggle');
  };
  document.body.appendChild(host);
  return { host, mask, panel, cells, cancelCell, show, log };
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
afterEach(async () => {
  document.body.innerHTML = '';
  await tick();
});

describe('uni-modal：Enter 激活打开确认框后同一次 keyup 不再「确定」', () => {
  it('更多操作「删除」（uni-view）Tab 聚焦按 Enter → 确认框开着、DELETE 未发；再 Enter（新按键）才确定', async () => {
    const m = uniModalSim();
    let deleted = 0;
    const del = view('more-act danger', () => {
      m.showModal({ title: '删除这道错题？', content: '删除后不可恢复', confirmText: '删除' }).then((r) => {
        if (r === 'confirm') deleted++;
      });
    });
    del.textContent = '删除';
    document.body.appendChild(del);
    del.focus();
    await press('Enter');
    expect(m.state.visible).toBe(true);
    expect(m.log).toEqual([]);
    expect(deleted).toBe(0);
    // dialog 语义 + 初始焦点在面板（保持 uni 原生 Enter=确定）
    expect(m.panel.getAttribute('role')).toBe('dialog');
    expect(m.panel.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(m.panel.getAttribute('aria-labelledby'))).toBe(m.title);
    expect(document.getElementById(m.panel.getAttribute('aria-describedby'))).toBe(m.bd);
    expect(document.activeElement).toBe(m.panel);
    expect(m.btnOk.getAttribute('tabindex')).toBe('0');
    expect(m.btnOk.getAttribute('role')).toBe('button');
    // 新的一次 Enter：uni 自身 keyup 确定
    await press('Enter');
    expect(m.log).toEqual(['confirm']);
    await tick();
    expect(deleted).toBe(1);
    expect(document.activeElement).toBe(del);
  });

  it('Space 激活（keyup 无 uni 语义）与鼠标点击路径不受影响：确认框开着，Escape 取消 → 焦点归还触发项', async () => {
    const m = uniModalSim();
    const del = view('more-act danger', () => m.showModal({ title: '删除这道错题？' }));
    del.textContent = '删除';
    document.body.appendChild(del);
    del.focus();
    await press(' ');
    expect(m.state.visible).toBe(true);
    await press('Escape');
    expect(m.log).toEqual(['cancel']);
    expect(document.activeElement).toBe(del);
  });

  it('Tab 圈定在「取消/确定」之间不落背景；焦点在 div 按钮上 Enter → 该按钮（取消），keyup 不再被 uni 当确定', async () => {
    const m = uniModalSim();
    const bg = view('bg', () => {});
    document.body.appendChild(bg);
    const open = view('open', () => m.showModal({ title: '退出登录？' }));
    document.body.appendChild(open);
    open.focus();
    await press(' ');
    expect(document.activeElement).toBe(m.panel);
    await press('Tab');
    expect(document.activeElement).toBe(m.btnCancel);
    await press('Tab');
    expect(document.activeElement).toBe(m.btnOk);
    await press('Tab');
    expect(document.activeElement).toBe(m.btnCancel);
    await press('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(m.btnOk);
    expect(document.activeElement).not.toBe(bg);
    await press('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(m.btnCancel);
    await press('Enter');
    expect(m.log).toEqual(['cancel']);
    expect(document.activeElement).toBe(open);
  });

  it('showCancel=false（仅「知道了」）：唯一按钮进 Tab 序；editable：初始焦点落 textarea，有内容首次 Escape 只 blur 且 uni 不取消', async () => {
    const m = uniModalSim();
    const open = view('open', () => m.showModal({ title: '备份成功', showCancel: false, confirmText: '知道了' }));
    document.body.appendChild(open);
    open.focus();
    await press(' ');
    await press('Tab');
    expect(document.activeElement).toBe(m.btnOk);
    await press('Tab');
    expect(document.activeElement).toBe(m.btnOk);
    await press('Enter');
    expect(m.log).toEqual(['confirm']);
    // editable
    const open2 = view('open2', () => m.showModal({ title: '输入恢复码', editable: true }));
    document.body.appendChild(open2);
    open2.focus();
    await press(' ');
    const ta = m.panel.querySelector('textarea');
    expect(document.activeElement).toBe(ta);
    ta.value = 'ABCD';
    await press('Escape');
    expect(m.state.visible).toBe(true);
    expect(m.log).toEqual(['confirm']);
    expect(document.activeElement).toBe(m.panel);
    await press('Escape');
    expect(m.log).toEqual(['confirm', 'cancel']);
    expect(document.activeElement).toBe(open2);
  });

  it.each([
    ['确认框先开、更多操作层后离场（被压层不抢焦点）', 0, 5],
    ['更多操作层先离场、确认框后开', 5, 0],
  ])('真实时序 %s：焦点落确认框，确认后回 FAB', async (_n, modalDelay, leaveDelay) => {
    const m = uniModalSim();
    const fab = view('fab-main', () => {
      popup.style.display = '';
      popup.className = 'wd-popup';
    });
    fab.setAttribute('aria-label', '更多操作');
    document.body.appendChild(fab);
    const wrap = document.createElement('div');
    const ov = div('wd-overlay', '', () => {
      popup.className = 'wd-popup wd-fade-leave-active';
      setTimeout(() => (popup.style.display = 'none'), 20);
    });
    const popup = div('wd-popup');
    popup.style.display = 'none';
    const del = view('more-act danger', () => {
      setTimeout(() => ov.click(), leaveDelay);
      setTimeout(() => m.showModal({ title: '删除这道错题？' }), modalDelay);
    });
    del.textContent = '删除';
    popup.appendChild(del);
    wrap.append(ov, popup);
    document.body.appendChild(wrap);
    fab.focus();
    await press(' ');
    expect(document.activeElement).toBe(del);
    await press('Enter');
    await new Promise((r) => setTimeout(r, 40));
    expect(m.state.visible).toBe(true);
    expect(m.log).toEqual([]);
    expect(document.activeElement).toBe(m.panel);
    await press('Enter');
    expect(m.log).toEqual(['confirm']);
    expect(document.activeElement).toBe(fab);
  });

  it('uni-fade 离场态即视为关闭（焦点立即归还）；z-index 提到 --z-overlay 档 + 栈深压过同档 KgSheet', async () => {
    const m = uniModalSim();
    const open = view('open', () => m.showModal({ title: 'x' }));
    document.body.appendChild(open);
    open.focus();
    await press(' ');
    expect(m.host.style.zIndex).toBe('1001');
    m.host.className = 'uni-fade-leave-active uni-fade-leave-to';
    await tick();
    expect(document.activeElement).toBe(open);
  });
});

describe('uni-actionsheet：进栏 + Esc 点遮罩 + 菜单项可 Tab/Enter', () => {
  it('打开：焦点落首个菜单项（占位空 cell 不进序）；Tab 圈定；Enter 选中项；Escape → 点遮罩 close(-1) → 焦点归还', async () => {
    const s = uniActionSheetSim(['移动到…', '删除']);
    const open = view('open', () => s.show());
    document.body.appendChild(open);
    open.focus();
    await press(' ');
    expect(s.panel.getAttribute('role')).toBe('dialog');
    expect(document.activeElement).toBe(s.cells[0]);
    expect(s.mask.style.zIndex).toBe('1001');
    expect(s.panel.style.zIndex).toBe('1001');
    await press('Tab');
    expect(document.activeElement).toBe(s.cells[1]);
    await press('Tab');
    expect(document.activeElement).toBe(s.cancelCell);
    await press('Tab');
    expect(document.activeElement).toBe(s.cells[0]);
    await press('Escape');
    expect(s.log).toEqual([-1]);
    expect(document.activeElement).toBe(open);
    open.focus();
    await press(' ');
    await press('Tab');
    await press('Enter');
    expect(s.log).toEqual([-1, 1]);
    expect(document.activeElement).toBe(open);
  });
});
