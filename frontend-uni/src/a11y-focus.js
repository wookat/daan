// 键盘可达性：uni-app h5 把交互元素编译为无 tabindex 的 uni-view/uni-text div，<button> 也是自定义元素
// <uni-button>（非原生 button，不在 Tab 序列），整站无任何键盘落点。在 Vue runtime 挂 click 监听时给宿主补 tabindex + Enter/Space 激活；
// role=button 延迟到 rAF 只给叶子级短文本元素，避免 button 角色扁平化容器子树语义。
import { reconcileStack, zIndexFor, pickFocusTarget, pickRestoreTarget, nextTabIndex, modalEntry, modalKeyAction, isTextWithValue } from './modal-policy.js'

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
  const sync = () => {
    const { removed, kept } = reconcileStack(stack, (s) => s.box.isConnected && visible(s.box))
    stack = kept
    removed.forEach(({ lastFocus }) => {
      const el = pickRestoreTarget(lastFocus, (n) => n.isConnected && visible(n), maskFocusables)
      if (el && typeof el.focus === 'function') el.focus()
    })
    document.querySelectorAll('.mask, .wd-popup').forEach((node) => {
      if (!visible(node) || stack.some((s) => s.box === node)) return
      const entry = modalEntry(node, node.classList.contains('wd-popup') ? overlayOf(node) : null)
      stack.push({ ...entry, lastFocus: openerChain() })
      entry.layers.forEach((m) => {
        m.style.zIndex = String(zIndexFor(stack.length, overlayBase()))
      })
      const { el, needsTabindex } = pickFocusTarget(maskFocusables(entry.box), entry.box.firstElementChild || entry.box)
      if (needsTabindex) el.setAttribute('tabindex', '-1')
      el.focus()
    })
  }
  const mo = new MutationObserver(sync)
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] })
  document.addEventListener(
    'keydown',
    (e) => {
      const top = stack.length ? stack[stack.length - 1] : null
      if (!top) return
      const action = modalKeyAction(e.key, e.isComposing, isTextWithValue(document.activeElement))
      if (!action) return
      if (action === 'blur') {
        e.preventDefault()
        e.stopPropagation()
        const { el, needsTabindex } = pickFocusTarget([], top.box.firstElementChild || top.box)
        if (needsTabindex) el.setAttribute('tabindex', '-1')
        el.focus()
        return
      }
      if (action === 'dismiss') {
        if (!top.hit) return
        e.preventDefault()
        e.stopPropagation()
        top.hit.click()
        return
      }
      e.preventDefault()
      e.stopPropagation()
      const items = maskFocusables(top.box)
      const ni = nextTabIndex(items.length, items.indexOf(document.activeElement), e.shiftKey)
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
