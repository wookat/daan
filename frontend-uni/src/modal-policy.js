// 弹层「打开顺序栈」决策纯函数（a11y-focus.js 调用方持有 DOM 与副作用）。
// 与 edge-policy.js 同构：决策可单测，DOM 操作留在运行时模块。
// 基准 = 设计系统 --z-overlay（遮罩+sheet 档，SPEC §层级）。KgSheet/wd-popup 也落在该档，
// 栈内 .mask 必须在其之上，否则从 sheet 底栏打开的确认层会被 sheet 盖住不可点。
export const BASE_Z = 1000

// 栈对帐：present(entry) 为「mask 仍存在且可见」判定。
// removed 按栈顶到栈底逆序返回，调用方依序归还各自 lastFocus。
export function reconcileStack(stack, present) {
  const removed = []
  const kept = []
  stack.forEach((entry) => {
    if (present(entry)) kept.push(entry)
    else removed.push(entry)
  })
  removed.reverse()
  return { removed, kept }
}

// 入栈后的层级：基准档 + 栈深，保证后开的层视觉在最上（含压过同档的 KgSheet）。
export function zIndexFor(depth, base = BASE_Z) {
  return (base > 0 ? base : BASE_Z) + depth
}

// 弹层节点 → 栈条目：box = 焦点圈定范围，hit = Esc 时派发 click 的遮罩，layers = 入栈需提 z-index 的节点。
// .mask 自身即遮罩；wd-popup（KgSheet / wd-datetime-picker）的遮罩是同级 .wd-overlay
// （wot closeOnClickModal 默认 true，点遮罩 → update:modelValue false + close，等价用户点遮罩）；
// 无遮罩（modal=false）的 popup 只圈定焦点，Esc 不关（hit=null）。
export function modalEntry(el, overlay) {
  if (el.classList && el.classList.contains('wd-popup')) {
    return { box: el, hit: overlay || null, layers: overlay ? [overlay, el] : [el] }
  }
  return { box: el, hit: el, layers: [el] }
}

// wot wd-transition 离场态：关闭后先挂 `wd-<name>-leave(-active|-to)`，动画结束才 display:none；
// hide-when-close=false 的 popup（wd-datetime-picker 为避免 picker-view 隐藏时乱发 change 有意不隐藏）会永久留在
// 离屏的 leave-to 态且仍有 client rect，仅按几何可见会把它当作开着的模态层。
const LEAVE_RE = /^wd-[\w-]*-leave(-active|-to)?$/
export function isTransitionLeaving(className) {
  return String(className || '').split(/\s+/).some((c) => LEAVE_RE.test(c))
}

// keydown → 弹层动作：输入法组合中的 Escape/Tab 交给 IME，不当弹层键；
// 焦点在有内容的文本控件时首次 Escape 只退出该控件（blur），避免一键掉表单草稿；再按才关层。
export function modalKeyAction(key, isComposing, textWithValue) {
  if (isComposing) return null
  if (key === 'Escape') return textWithValue ? 'blur' : 'dismiss'
  if (key === 'Tab') return 'cycle'
  return null
}

export function isTextWithValue(el) {
  if (!el) return false
  const tag = el.tagName
  if (tag !== 'INPUT' && tag !== 'TEXTAREA') return false
  return typeof el.value === 'string' && el.value.length > 0
}

// 关层后焦点归还：chain = 打开时的 activeElement 及其祖先链（由近到远）。触发元素仍在 → 归还它；
// 触发元素已被卸掉（如 fab 菜单项 v-if 随菜单收起）→ 归还最近仍在的祖先内首个可聚焦项（fab 主按钮），避免落到 body。
export function pickRestoreTarget(chain, alive, focusablesIn) {
  if (!chain.length) return null
  if (alive(chain[0])) return chain[0]
  for (let i = 1; i < chain.length; i++) {
    if (!alive(chain[i])) continue
    const f = focusablesIn(chain[i])
    if (f.length) return f[0]
  }
  return null
}

// 打开时焦点落点：有可聚焦元素取首个；空弹层落到 fallback 并补 tabindex=-1。
export function pickFocusTarget(focusables, fallback) {
  if (focusables.length) return { el: focusables[0], needsTabindex: false }
  return { el: fallback, needsTabindex: true }
}

// Tab 循环下一焦点下标；current=-1 表示 activeElement 不在列表内。
export function nextTabIndex(count, current, shift) {
  if (count <= 0) return -1
  if (shift) return current <= 0 ? count - 1 : current - 1
  return current < 0 || current >= count - 1 ? 0 : current + 1
}
