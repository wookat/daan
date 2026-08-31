// 键盘可达性：uni-app h5 把交互元素编译为无 tabindex 的 uni-view/uni-text div，
// 整站无任何键盘落点。在 Vue runtime 挂 click 监听时给宿主补 tabindex + Enter/Space 激活；
// role=button 延迟到 rAF 只给叶子级短文本元素，避免 button 角色扁平化容器子树语义。
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

function topMask() {
  const masks = document.querySelectorAll('.mask')
  for (let i = masks.length - 1; i >= 0; i--) {
    if (visible(masks[i])) return masks[i]
  }
  return null
}

function maskFocusables(mask) {
  return Array.from(mask.querySelectorAll('[tabindex]')).filter(
    (el) => el !== mask && visible(el) && el.getAttribute('tabindex') !== '-1'
  )
}

function initModalKeys() {
  let openMask = null
  let lastFocus = null
  const sync = () => {
    const m = topMask()
    if (m === openMask) return
    if (m) {
      if (!openMask) lastFocus = document.activeElement
      openMask = m
      const first = maskFocusables(m)[0]
      if (first) first.focus()
    } else {
      openMask = null
      if (lastFocus && lastFocus.isConnected && typeof lastFocus.focus === 'function') lastFocus.focus()
      lastFocus = null
    }
  }
  const mo = new MutationObserver(sync)
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] })
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' && e.key !== 'Tab') return
      const m = topMask()
      if (!m) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        m.click()
        return
      }
      const items = maskFocusables(m)
      if (!items.length) return
      e.preventDefault()
      e.stopPropagation()
      const i = items.indexOf(document.activeElement)
      let next
      if (e.shiftKey) next = i <= 0 ? items[items.length - 1] : items[i - 1]
      else next = i < 0 || i >= items.length - 1 ? items[0] : items[i + 1]
      next.focus()
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
  st.textContent = ':focus:not(:focus-visible){outline:none}:focus-visible{outline:2px solid #2e5bff;outline-offset:2px;border-radius:4px}'
  document.head.appendChild(st)
}
