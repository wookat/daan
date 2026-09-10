// 弹层（KgSheet）与浏览器历史：弹层打开时 pushState 一条同 URL 的「弹层条目」（复制 vue-router/uni 的 state
// 保留 position/__id__，只加 __kgSheet 标记），系统返回 / 浏览器 Back / 页头返回先关弹层而不是离开页面。
// 关闭走 X / Esc / 点遮罩时**不**主动 history.back()（同一手势里常伴随 navigateTo，back 会与之竞争把新页面弹回），
// 该条目留作「哑条目」，用户下一次 Back 落到哑条目上时由 popstate 再补一次 back，保证一次 Back 仍离开页面。

export function markerOf(state) {
  const m = state && state.__kgSheet
  return m && typeof m.t === 'number' ? m : null
}

/** 页面身份：origin + pathname + hash 路由路径（不含 query）——页面自己 replaceState 改筛选参数（book syncBookUrl）不换页 */
export function pageKey(href) {
  try {
    const u = new URL(href)
    return u.origin + u.pathname + u.search + u.hash.split('?')[0]
  } catch {
    return String(href || '')
  }
}

/** 弹层条目对当前页面才有效：vue-router replace 会把旧 state 整体拷到新条目，跨页残留的标记视为无 */
export function validMarker(state, href) {
  const m = markerOf(state)
  return m && typeof m.u === 'string' && pageKey(m.u) === pageKey(href) ? m.t : null
}

/**
 * popstate 决策（纯函数）。prev/land：离开/落到的条目上的有效弹层 token（无则 null）；isOpen(token)：该弹层是否仍打开；
 * skipping：正在从更深页面返回、逐条跳过本页哑条目（落到本页真条目就停）；从本页哑条目上离开的链不算 skipping，
 * 连续开关多次留下的一串哑条目也要一直补 back 到真正离页。
 * away：从哑条目上离开但落到的不是本页真条目（地址栏/书签改 hash、Forward 到别页等前向导航）——不是 Back，不补 back。
 * 返回 { type: 'close'|'back'|'none', token?, skipping }。
 */
export function popAction(prev, land, isOpen, skipping, away = false) {
  if (prev != null && land === prev) {
    // 从更深页面返回到弹层条目：弹层仍开着（KeepAlive 页保留状态）则保持一致；已关则是哑条目，跳过
    return isOpen(land) ? { type: 'none', skipping: false } : { type: 'back', skipping: true }
  }
  if (prev != null && isOpen(prev)) return { type: 'close', token: prev, skipping: false }
  if (land != null && !isOpen(land)) return { type: 'back', skipping: prev == null || skipping }
  if (skipping) return { type: 'none', skipping: false }
  if (prev != null && !away) return { type: 'back', skipping: false }
  return { type: 'none', skipping: false }
}

export function canPush(state) {
  return !!state && typeof state.position === 'number'
}

let seq = 0
const open = new Map()
let prev = null
let skipping = false
let installed = false
let routerHooked = false
let curHref = null
let popping = false
let prevKey = null
let histLen = 0
const landedFns = new Set()

function syncPrev() {
  prev = validMarker(window.history.state, window.location.href)
  prevKey = prev != null ? pageKey(window.location.href) : null
  histLen = window.history.length
}

/** vue-router history 的 popstate 监听（同步、早于其 afterEach 微任务）：标记「本次 afterEach 由 popstate 引发」 */
export function noteHistoryPop() {
  popping = true
}

/**
 * 路由 push/replace 后同步「当前条目」；replace 拷过来的跨页残留标记顺手清掉（由 router.afterEach 调用）。
 * popstate 引发的 afterEach 不动：vue-router 的 afterEach 先于本模块 popstate 触发（同 URL 为 NAVIGATION_DUPLICATED），
 * 若此时按落地 state 覆写 prev，popstate 里就丢了「离开的是弹层条目」这一事实，层关不掉；
 * 离开/落地由 onPop 统一判。仅比对 href 不够：uni 切 tab 会在 afterEach 之后再 replaceState 抹掉 query，
 * 页面自身（错题本筛选）也会不经 router 改写 URL，curHref 就与真实地址错位。
 */
export function noteRouteChange() {
  if (popping) {
    popping = false
    return
  }
  if (window.location.href === curHref) return
  curHref = window.location.href
  const st = window.history.state
  if (markerOf(st) && !validMarker(st, window.location.href)) {
    const rest = { ...st }
    delete rest.__kgSheet
    window.history.replaceState(rest, '')
  }
  syncPrev()
}

function onPop() {
  popping = false
  curHref = window.location.href
  const land = validMarker(window.history.state, window.location.href)
  // Back 从哑条目落回本页真条目：同页且历史长度不变；地址栏/书签改 hash 会新建条目（长度增）或落到别页
  const away = prev != null && land == null && (window.history.length > histLen || pageKey(window.location.href) !== prevKey)
  const act = popAction(prev, land, (t) => open.has(t), skipping, away)
  const landed = skipping && land == null && !away && act.type === 'none'
  syncPrev()
  skipping = act.skipping
  if (act.type === 'close') {
    const close = open.get(act.token)
    if (close) close()
  } else if (act.type === 'back') {
    window.history.back()
  } else if (landed) {
    for (const fn of landedFns) fn(window.location.href)
  }
}

/**
 * 跳过哑条目链后落到本页真条目时回调（href 为落地地址）。哑条目是在弹层打开那一刻的 URL 上 push 的，
 * 之后页面 replaceState 改的只是最上面那条（哑条目），真条目仍是弹层打开前的 query；页面据此把 URL 重新对齐到当前状态。
 * 返回取消订阅函数。
 */
export function onSheetHistoryLanded(fn) {
  landedFns.add(fn)
  return () => landedFns.delete(fn)
}

/** 启动时装（App.vue onLaunch，传 app.$router）：刷新后落在哑条目上也能在首次 Back 时补跳，不依赖有弹层先打开 */
export function installSheetHistory(router) {
  if (typeof window === 'undefined') return
  if (!installed) {
    installed = true
    window.addEventListener('popstate', onPop)
    curHref = window.location.href
    syncPrev()
  }
  if (!routerHooked && router && typeof router.afterEach === 'function') {
    routerHooked = true
    router.afterEach(noteRouteChange)
    const h = router.options && router.options.history
    if (h && typeof h.listen === 'function') h.listen(noteHistoryPop)
  }
}

/** 弹层打开：返回 token；close 为关闭该弹层的回调（由 Back 触发） */
export function sheetOpened(close) {
  const app = typeof getApp === 'function' ? getApp() : null
  installSheetHistory(app && app.$router)
  // 刷新后 seq 归零，而当前条目可能就是上次留下的哑条目：新 token 不得与其重合，否则 Back 落回哑条目会被当成「层仍开着」
  const stale = validMarker(window.history.state, window.location.href)
  if (stale != null && stale > seq) seq = stale
  const t = ++seq
  open.set(t, close)
  if (canPush(window.history.state)) {
    const u = window.location.href
    window.history.pushState({ ...window.history.state, __kgSheet: { t, u } }, '', u)
    prev = t
    prevKey = pageKey(u)
    histLen = window.history.length
  }
  return t
}

/** 弹层关闭（任何途径）：只登出，不动历史 */
export function sheetClosed(t) {
  open.delete(t)
}

/** 测试用：重置模块状态 */
export function _resetSheetHistory() {
  seq = 0
  open.clear()
  prev = null
  prevKey = null
  histLen = 0
  skipping = false
  curHref = null
  popping = false
  landedFns.clear()
  if (installed && typeof window !== 'undefined') window.removeEventListener('popstate', onPop)
  installed = false
  routerHooked = false
}
