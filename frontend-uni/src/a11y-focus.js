// 键盘可达性：uni-app h5 把交互元素编译为无 tabindex 的 uni-view/uni-text div，<button> 也是自定义元素
// <uni-button>（非原生 button，不在 Tab 序列），整站无任何键盘落点。在 Vue runtime 挂 click 监听时给宿主补 tabindex + Enter/Space 激活；
// role=button 延迟到 rAF 只给叶子级短文本元素，避免 button 角色扁平化容器子树语义。
import {
  reconcileStack,
  zIndexFor,
  pickFocusTarget,
  pickRestoreTarget,
  nextTabIndex,
  modalEntry,
  modalKeyAction,
  isTextWithValue,
  isTransitionLeaving,
  NATIVE_LAYER_SEL,
  NATIVE_BTN_SEL,
  nativeKind,
  initialFocusables,
  shouldSwallowKeyup,
  shouldRetryFocus,
} from './modal-policy.js'

export const HOST_RE = /^UNI-(VIEW|TEXT|IMAGE|LABEL|BUTTON)$/

let rolePending = []
let roleScheduled = false

function assignRoles() {
  roleScheduled = false
  const els = rolePending
  rolePending = []
  els.forEach((el) => {
    if (!el.isConnected || el.getAttribute('role')) return
    if (el.querySelector('[tabindex]')) return
    const t = (el.textContent || '').trim()
    if (t.length > 0 && t.length <= 40) el.setAttribute('role', 'button')
  })
}

// 弹层键盘支持：Esc 关闭、Tab 圈定在弹层内、打开时焦点移入、关闭后焦点归还。两类弹层同入一栈：
// 1) <view class="mask" @click="close"> + 内层 @click.stop（export-confirm）：对 mask dispatch click 等价用户点遮罩；
// 2) wd-popup（KgSheet 封装、wd-datetime-picker）：焦点圈在 .wd-popup，Esc 点同级 .wd-overlay（见 modal-policy modalEntry）。
// 两者均 position:fixed（offsetParent 恒为 null），可见性用 getClientRects 判断（wd-popup 关闭后 display:none）
function visible(el) {
  return el.getClientRects().length > 0
}

// 弹层是否「开着」：进入离场动画即视为关闭（焦点立即归还，不等 display:none；不隐藏的 picker 离屏后不再圈焦点）
function modalOpen(el) {
  return el.isConnected && visible(el) && !isTransitionLeaving(el.className)
}

// uni-actionsheet 宿主常驻可见，开合看内部遮罩（v-show + uni-fade）；其余层看节点自身
function actionsheetMask(el) {
  return el.querySelector('.uni-actionsheet__mask')
}
function layerOpen(el) {
  if (nativeKind(el) === 'uni-actionsheet') {
    const m = actionsheetMask(el)
    return !!m && modalOpen(m)
  }
  return modalOpen(el)
}

function entryFor(node) {
  const kind = nativeKind(node)
  if (kind === 'uni-modal') return modalEntry(node, null, node.querySelector('.uni-modal') || node)
  if (kind === 'uni-actionsheet') return modalEntry(node, actionsheetMask(node), node.querySelector('.uni-actionsheet') || node)
  return modalEntry(node, node.classList.contains('wd-popup') ? overlayOf(node) : null)
}

// uni 原生层补 dialog 语义：面板 role=dialog + aria-modal，标题/正文作 labelledby/describedby，div 按钮补 tabindex + role=button
// （actionsheet 的标题占位空 cell 不补）。只写 uni 不管的属性，Vue patch 不会抹掉。
let nativeIdSeq = 0
function ensureId(el, prefix) {
  if (!el.id) el.id = prefix + ++nativeIdSeq
  return el.id
}
function decorateNativeLayer({ kind, panel }) {
  if (!kind) return
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  const title = panel.querySelector('.uni-modal__title, .uni-actionsheet__title')
  if (title && (title.textContent || '').trim()) panel.setAttribute('aria-labelledby', ensureId(title, 'kg-dlg-t'))
  else panel.removeAttribute('aria-labelledby')
  const body = panel.querySelector('.uni-modal__bd')
  if (body && (body.textContent || '').trim()) panel.setAttribute('aria-describedby', ensureId(body, 'kg-dlg-d'))
  else panel.removeAttribute('aria-describedby')
  panel.querySelectorAll(NATIVE_BTN_SEL).forEach((b) => {
    if (!(b.textContent || '').trim()) return
    b.setAttribute('tabindex', '0')
    b.setAttribute('role', 'button')
  })
}

// 补 tabindex 的宿主 + 原生文本控件（uni 的 <textarea>/<input> 内层原生元素无 tabindex 属性，手录表单靠它们进 Tab 序）
export const FOCUSABLE_SEL = '[tabindex], input, textarea, select, button, a[href]'

function maskFocusables(mask) {
  return Array.from(mask.querySelectorAll(FOCUSABLE_SEL)).filter(
    (el) => el !== mask && visible(el) && el.getAttribute('tabindex') !== '-1' && !el.disabled
  )
}

function ancestorChain(el) {
  const chain = []
  for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) chain.push(n)
  return chain
}

function overlayOf(popup) {
  const p = popup.parentElement
  return p ? Array.from(p.children).find((c) => c !== popup && c.classList.contains('wd-overlay')) || null : null
}

// 弹层层级以「打开顺序栈」为唯一事实：多个 .mask 同 z-index 时 DOM 顺序
// 决定层叠序，与打开顺序无关，会导致后开的弹层被盖住、Esc 关错层。
// 入栈时按栈深提升 z-index，Esc/Tab/焦点均作用于栈顶；决策见 modal-policy.js。
// 基准运行时读 --z-overlay（与 KgSheet 同源），栈内层才能压过同档的 wd-popup。
function overlayBase() {
  return parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--z-overlay'), 10)
}

function initModalKeys() {
  let stack = []
  // 入栈代数：按下→抬起期间变化 = 这次按键开了新层，它的 keyup 不得再驱动新层（uni-modal Enter=确定）
  let gen = 0
  let armed = null
  // 最近一次 focusin 的祖先链：触发元素若在弹层显示的同一次 DOM 批量中被卸掉（fab 菜单项），
  // MutationObserver 回调时 activeElement 已是 body，只能靠它找回归还位置。
  let focusChain = []
  document.addEventListener('focusin', (e) => {
    focusChain = ancestorChain(e.target)
  })
  const openerChain = () => {
    const a = document.activeElement
    return a && a !== document.body ? ancestorChain(a) : focusChain
  }
  // uni-actionsheet 面板 visibility:hidden→visible 走 0.3s transition，入栈那一帧 focus() 静默失败；逐帧重试直到拿到焦点或该层不再是栈顶
  const focusInto = (el, box) => {
    let tries = 0
    const attempt = () => {
      if (box.contains(document.activeElement)) return
      el.focus()
      if (box.contains(document.activeElement)) return
      const top = stack.length ? stack[stack.length - 1] : null
      if (!top || top.box !== box || !el.isConnected) return
      if (shouldRetryFocus(tries++)) requestAnimationFrame(attempt)
    }
    attempt()
  }
  const sync = () => {
    const { removed, kept } = reconcileStack(stack, (s) => layerOpen(s.box))
    stack = kept
    removed.forEach(({ lastFocus }) => {
      const el = pickRestoreTarget(lastFocus, (n) => n.isConnected && visible(n), maskFocusables)
      if (el && typeof el.focus === 'function') el.focus()
    })
    document.querySelectorAll('.mask, .wd-popup, ' + NATIVE_LAYER_SEL).forEach((node) => {
      // 离场后仍挂载且不 display:none 的弹层（hide-when-close=false 的 picker）滑到屏外仍在 Tab 序里 → inert 摘出
      const leaving = isTransitionLeaving(node.className)
      if (node.inert !== leaving) node.inert = leaving
      if (!layerOpen(node) || stack.some((s) => s.box === node)) return
      const entry = entryFor(node)
      decorateNativeLayer(entry)
      stack.push({ ...entry, lastFocus: openerChain() })
      gen++
      entry.layers.forEach((m) => {
        m.style.zIndex = String(zIndexFor(stack.length, overlayBase()))
      })
      const fallback = entry.kind ? entry.panel : entry.box.firstElementChild || entry.box
      const { el, needsTabindex } = pickFocusTarget(initialFocusables(entry.kind, maskFocusables(entry.box)), fallback)
      if (needsTabindex) el.setAttribute('tabindex', '-1')
      focusInto(el, entry.box)
    })
  }
  const mo = new MutationObserver(sync)
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] })
  window.addEventListener(
    'keydown',
    (e) => {
      armed = { key: e.key, gen, consumed: false }
    },
    true
  )
  window.addEventListener(
    'keyup',
    (e) => {
      if (shouldSwallowKeyup(armed, e.key, gen)) e.stopImmediatePropagation()
      armed = null
    },
    true
  )
  const consume = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (armed && armed.key === e.key) armed.consumed = true
  }
  document.addEventListener(
    'keydown',
    (e) => {
      const top = stack.length ? stack[stack.length - 1] : null
      if (!top) return
      const a = document.activeElement
      const onLayerButton = !!top.kind && !!a && a !== top.box && top.box.contains(a) && a.matches(NATIVE_BTN_SEL)
      const action = modalKeyAction(e.key, e.isComposing, isTextWithValue(a), onLayerButton)
      if (!action) return
      if (action === 'blur') {
        consume(e)
        const { el, needsTabindex } = pickFocusTarget([], top.kind ? top.panel : top.box.firstElementChild || top.box)
        if (needsTabindex) el.setAttribute('tabindex', '-1')
        el.focus()
        return
      }
      if (action === 'dismiss') {
        if (!top.hit) return
        consume(e)
        top.hit.click()
        return
      }
      if (action === 'activate') {
        consume(e)
        a.click()
        return
      }
      consume(e)
      const items = maskFocusables(top.box)
      const ni = nextTabIndex(items.length, items.indexOf(a), e.shiftKey)
      if (ni >= 0) items[ni].focus()
    },
    true
  )
}

// 键盘焦点环只给按钮/链接/选项；原生文本控件不画环（uni 的 <input> 会在容器胶囊内再套一个方框），
// 改由输入容器 :focus-within 描边——已知容器优先，裸露的 uni-input/uni-textarea 宿主兜底
const TEXT_CTRL = ':not(input):not(textarea):not(.uni-input-input):not(.uni-textarea-textarea)'
const INPUT_BOX = ['.searchbar', '.wd-search__block', '.wd-input', '.kg-input', '.search']
const RING = 'outline:2px solid var(--brand);outline-offset:-1px'
export const FOCUS_CSS = [
  ':focus:not(:focus-visible){outline:none}',
  TEXT_CTRL + ':focus-visible{outline:2px solid var(--brand);outline-offset:2px;border-radius:4px}',
  INPUT_BOX.map((s) => s + ':focus-within').join(',') + '{' + RING + '}',
  'uni-input:focus-within,uni-textarea:focus-within{' + RING + '}',
  INPUT_BOX.map((s) => s + ' uni-input:focus-within,' + s + ' uni-textarea:focus-within').join(',') + '{outline:none}',
].join('')

export function initKeyboardFocus() {
  if (typeof window === 'undefined' || window.__kgA11yFocus) return
  window.__kgA11yFocus = true
  const proto = window.Element.prototype
  const orig = proto.addEventListener
  proto.addEventListener = function (type, fn, opts) {
    if (type === 'click' && HOST_RE.test(this.tagName) && !this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '0')
      orig.call(this, 'keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === this) {
          e.preventDefault()
          this.click()
        }
      })
      rolePending.push(this)
      if (!roleScheduled) {
        roleScheduled = true
        requestAnimationFrame(assignRoles)
      }
    }
    return orig.call(this, type, fn, opts)
  }
  initModalKeys()
  const st = document.createElement('style')
  st.textContent = FOCUS_CSS
  document.head.appendChild(st)
}
