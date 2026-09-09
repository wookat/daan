// 弹层「打开顺序栈」决策纯函数（a11y-focus.js 调用方持有 DOM 与副作用）。
// 与 edge-policy.js 同构：决策可单测，DOM 操作留在运行时模块。
// 基准 = 设计系统 --z-overlay（遮罩+sheet 档，SPEC §层级）。KgSheet/wd-popup 也落在该档，
// 栈内 .mask 必须在其之上，否则从 sheet 底栏打开的确认层会被 sheet 盖住不可点。
export const BASE_Z = 1000

// 栈对帐：present(entry) 为「mask 仍存在且可见」判定。
// removed 按栈顶到栈底逆序返回，调用方依序归还各自 lastFocus。
// removed：其上已无开着的层 → 归还焦点；buried：上面还有开着的层（更多操作层点「删除」→ 层关 + uni-modal 开）→ 不动焦点，
// 把它的 lastFocus 交给上面最近一个存活层（该层关闭时焦点回到最初的触发项，而不是已隐藏层里的菜单项）。
export function reconcileStack(stack, present) {
  const alive = stack.map(present)
  const lastKept = alive.lastIndexOf(true)
  const removed = []
  const buried = []
  const kept = []
  let inherit = null
  stack.forEach((entry, i) => {
    if (alive[i]) {
      kept.push(inherit ? { ...entry, lastFocus: inherit } : entry)
      inherit = null
    } else if (i > lastKept) {
      removed.push(entry)
    } else {
      buried.push(entry)
      if (!inherit) inherit = entry.lastFocus
    }
  })
  removed.reverse()
  return { removed, buried, kept }
}

// 入栈后的层级：基准档 + 栈深，保证后开的层视觉在最上（含压过同档的 KgSheet）。
export function zIndexFor(depth, base = BASE_Z) {
  return (base > 0 ? base : BASE_Z) + depth
}

// uni-h5 原生 API 层：uni.showModal → <uni-modal>（宿主 v-show，Transition uni-fade）；uni.showActionSheet → <uni-actionsheet>
// （宿主常驻无定位，开合体现在内部 .uni-actionsheet__mask 的 v-show 与面板 .uni-actionsheet_toggle 类）。
// 两者按钮/菜单项都是无 tabindex 的 div、无 dialog 语义、不移焦点、不圈 Tab；uni 只在 document keyup 上处理 Esc（取消）与 Enter（确定）。
export const NATIVE_LAYER_SEL = 'uni-modal, uni-actionsheet'
export const NATIVE_BTN_SEL = '.uni-modal__btn, .uni-actionsheet__cell'
export function nativeKind(el) {
  const tag = el && el.tagName
  if (tag === 'UNI-MODAL') return 'uni-modal'
  if (tag === 'UNI-ACTIONSHEET') return 'uni-actionsheet'
  return null
}

// 弹层节点 → 栈条目：box = 焦点圈定范围，hit = Esc 时派发 click 的遮罩，layers = 入栈需提 z-index 的节点，
// panel = dialog 语义与空层兜底焦点所在的面板（默认 box）。
// .mask 自身即遮罩；wd-popup（KgSheet / wd-datetime-picker）的遮罩是同级 .wd-overlay
// （wot closeOnClickModal 默认 true，点遮罩 → update:modelValue false + close，等价用户点遮罩）；
// 无遮罩（modal=false）的 popup 只圈定焦点，Esc 不关（hit=null）。
// uni-modal：Esc/Enter 交给 uni 自身 keyup（hit=null，保持 Enter=确定 的原生语义）；uni-actionsheet：遮罩 onClick=_close(-1)，
// 宿主不定位，提 z-index 的是遮罩与面板。
export function modalEntry(el, overlay, panel) {
  const kind = nativeKind(el)
  if (kind === 'uni-modal') return { box: el, hit: null, layers: [el], panel: panel || el, kind }
  if (kind === 'uni-actionsheet') {
    const p = panel || el
    return { box: el, hit: overlay || null, layers: overlay ? [overlay, p] : [p], panel: p, kind }
  }
  if (el.classList && el.classList.contains('wd-popup')) {
    return { box: el, hit: overlay || null, layers: overlay ? [overlay, el] : [el], panel: el, kind: null }
  }
  return { box: el, hit: el, layers: [el], panel: el, kind: null }
}

// 入栈时的初始焦点候选：uni-modal 非可编辑时不落到按钮上（首个是「取消」，会把 uni 原生 Enter=确定 变成 Enter=取消），
// 落面板本身（tabindex=-1），Tab 再进「取消/确定」；可编辑（editable）落 textarea。其它层沿用首个可聚焦项。
export function initialFocusables(kind, focusables) {
  if (kind !== 'uni-modal') return focusables
  return focusables.filter((el) => el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')
}

// 同一次按键的 keyup 不得再到达页面级 keyup 监听（uni-h5 usePopup 在 document keyup 上把 Enter 当确定、Esc 当取消）：
// 1) 按下期间有新层入栈（gen 变化）——更多操作层「删除」按 Enter：keydown 激活 → 打开删除确认 → 同一次 keyup 直接「确定」，
//    确认被整层跳过（本地实测 DELETE 直发）；2) keydown 已被弹层栈消费（Esc 只 blur 文本控件 / Enter 激活按钮）。
export function shouldSwallowKeyup(armed, key, gen) {
  return !!armed && armed.key === key && (armed.consumed || armed.gen !== gen)
}

// 入栈首帧 focus() 可能静默失败（uni-actionsheet 面板 visibility 走 0.3s transition，那一帧计算值仍 hidden）；
// 按帧重试上限 ≈ 0.5s（30 帧 @60Hz），超过即放弃，避免层被卡住时永远轮询
export const FOCUS_RETRY_MAX = 30
export function shouldRetryFocus(tries) {
  return tries < FOCUS_RETRY_MAX
}

// wot wd-transition 离场态：关闭后先挂 `wd-<name>-leave(-active|-to)`，动画结束才 display:none；
// hide-when-close=false 的 popup（wd-datetime-picker 为避免 picker-view 隐藏时乱发 change 有意不隐藏）会永久留在
// 离屏的 leave-to 态且仍有 client rect，仅按几何可见会把它当作开着的模态层。
// uni-h5 原生层用 Transition name="uni-fade"，离场类 uni-fade-leave-active/-to 同口径。
const LEAVE_RE = /^(wd-[\w-]*|uni-fade)-leave(-active|-to)?$/
export function isTransitionLeaving(className) {
  return String(className || '').split(/\s+/).some((c) => LEAVE_RE.test(c))
}

// keydown → 弹层动作：输入法组合中的 Escape/Tab 交给 IME，不当弹层键；
// 焦点在有内容的文本控件时首次 Escape 只退出该控件（blur），避免一键掉表单草稿；再按才关层。
// 焦点在原生层的 div 按钮（uni-modal 取消/确定、actionsheet 菜单项）上 Enter/Space → 激活（div 无原生键盘激活）。
export function modalKeyAction(key, isComposing, textWithValue, onLayerButton) {
  if (isComposing) return null
  if (key === 'Escape') return textWithValue ? 'blur' : 'dismiss'
  if (key === 'Tab') return 'cycle'
  if ((key === 'Enter' || key === ' ') && onLayerButton) return 'activate'
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
