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
