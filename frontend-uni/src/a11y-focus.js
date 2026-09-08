// 键盘可达性：uni-app h5 把交互元素编译为无 tabindex 的 uni-view/uni-text div，
// 整站无任何键盘落点。在 Vue runtime 挂 click 监听时给宿主补 tabindex + Enter/Space 激活；
// role=button 延迟到 rAF 只给叶子级短文本元素，避免 button 角色扁平化容器子树语义。
import { reconcileStack, zIndexFor, pickFocusTarget, nextTabIndex } from './modal-policy.js'

const HOST_RE = /^UNI-(VIEW|TEXT|IMAGE|LABEL)$/

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

// 弹层（.mask 遮罩 + 内层 sheet）键盘支持：全站弹层统一为
// <view class="mask" @click="close"> + 内层 @click.stop，点遮罩即关闭，
// 故对 mask dispatch click 等价于用户点遮罩。Esc 关闭、Tab 圈定在弹层内、
// 打开时焦点移入、关闭后焦点归还。
// .mask 为 position:fixed（offsetParent 恒为 null），可见性用 getClientRects 判断
function visible(el) {
  return el.getClientRects().length > 0
}

function maskFocusables(mask) {
  return Array.from(mask.querySelectorAll('[tabindex]')).filter(
    (el) => el !== mask && visible(el) && el.getAttribute('tabindex') !== '-1'
  )
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
  const sync = () => {
    const { removed, kept } = reconcileStack(stack, (s) => s.mask.isConnected && visible(s.mask))
    stack = kept
    removed.forEach(({ lastFocus }) => {
      if (lastFocus && lastFocus.isConnected && typeof lastFocus.focus === 'function') lastFocus.focus()
    })
    document.querySelectorAll('.mask').forEach((m) => {
      if (!visible(m) || stack.some((s) => s.mask === m)) return
      stack.push({ mask: m, lastFocus: document.activeElement })
      m.style.zIndex = String(zIndexFor(stack.length, overlayBase()))
      const { el, needsTabindex } = pickFocusTarget(maskFocusables(m), m.firstElementChild || m)
      if (needsTabindex) el.setAttribute('tabindex', '-1')
      el.focus()
    })
  }
  const mo = new MutationObserver(sync)
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] })
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' && e.key !== 'Tab') return
      const top = stack.length ? stack[stack.length - 1] : null
      if (!top) return
      const m = top.mask
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        m.click()
        return
      }
      e.preventDefault()
      e.stopPropagation()
      const items = maskFocusables(m)
      const ni = nextTabIndex(items.length, items.indexOf(document.activeElement), e.shiftKey)
      if (ni >= 0) items[ni].focus()
    },
    true
  )
}

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
  st.textContent = ':focus:not(:focus-visible){outline:none}:focus-visible{outline:2px solid var(--brand);outline-offset:2px;border-radius:4px}'
  document.head.appendChild(st)
}
