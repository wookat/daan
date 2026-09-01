<script>
// #ifdef H5
import { initReminderLoop } from './reminder.js'
// #endif
import { applyTheme, watchSystemTheme } from './theme.js'
import { flushOfflineQueue, watchNetwork } from './offline.js'

export default {
  onLaunch: function () {
    try { uni.setLocale('zh-Hans') } catch (e) { /* 旧基础库不支持时忽略 */ }
    // #ifdef H5
    const h = window.location.hash || ''
    const m = h.match(/^#\/pages\/(exam|shenlun|user)\//)
    if (m) window.location.replace(window.location.pathname + h.replace('#/pages/', '#/pkgA/'))
    initReminderLoop()
    // 无障碍：uni 运行时生成的页面结构无 main landmark，给当前页 uni-page-body 挂 role="main"
    const markMain = () => {
      const bodies = document.querySelectorAll('uni-page-body')
      bodies.forEach((el, i) => {
        if (i === bodies.length - 1) el.setAttribute('role', 'main')
        else el.removeAttribute('role')
      })
      // 页头/tabbar 挂 landmark，页头标题镜像为 sr-only h1（uni 编译产物无任何 heading）
      const heads = document.querySelectorAll('uni-page-head')
      heads.forEach((el, i) => {
        if (i === heads.length - 1) el.setAttribute('role', 'banner')
        else el.removeAttribute('role')
      })
      const bar = document.querySelector('.uni-tabbar')
      if (bar && !bar.getAttribute('role')) {
        bar.setAttribute('role', 'navigation')
        bar.setAttribute('aria-label', '主导航')
      }
      const cur = bodies[bodies.length - 1]
      if (cur && !cur.querySelector('h1')) {
        const headTitle = heads.length ? (heads[heads.length - 1].querySelector('.uni-page-head__title') || {}).textContent : ''
        const h1 = document.createElement('h1')
        h1.setAttribute('data-a11y', '1')
        h1.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0'
        h1.textContent = (headTitle || document.title || '').trim() || '错题邦'
        cur.prepend(h1)
      }
      // tabbar 图标为装饰图（文字 label 承载语义），uni 生成的 img 无 alt
      document.querySelectorAll('.uni-tabbar__icon img').forEach((el) => el.setAttribute('aria-hidden', 'true'))
      // uni 编译后的真实 input/textarea 无 label，把 placeholder 镜像为 aria-label
      document.querySelectorAll('uni-input input:not([aria-label]), uni-textarea textarea:not([aria-label])').forEach((el) => {
        const host = el.closest('uni-input, uni-textarea')
        const ph = el.getAttribute('placeholder') || (host && (host.querySelector('.uni-input-placeholder, .uni-textarea-placeholder') || {}).textContent) || ''
        if (ph.trim()) el.setAttribute('aria-label', ph.trim())
      })
      // 离线直入未缓存路由时，uni 内置 async-error 文案（连接服务器超时）误导且无自动恢复；
      // 仅离线时替换文案并在网络恢复后自动触发其点击重试，在线时保持 uni 原生语义
      document.querySelectorAll('.uni-async-error').forEach((el) => {
        if (navigator.onLine || el.dataset.kgOffline) return
        el.dataset.kgOffline = '1'
        el.textContent = '当前无网络，该页面尚未缓存到本机；网络恢复后将自动重试'
        window.addEventListener('online', () => { if (el.isConnected) el.click() }, { once: true })
      })
    }
    markMain()
    new MutationObserver(markMain).observe(document.body, { childList: true, subtree: true })
    // #endif
    applyTheme()
    watchSystemTheme()
    watchNetwork()
  },
  onShow: function () {
    flushOfflineQueue()
  },
  onHide: function () {},
}
</script>

<style>
/* 全局设计规范 */
page {
  /* design-v3 tokens（docs/design-v3/DESIGN.md） */
  --brand: #2e5bff;
  --brand-soft: #eef3ff;
  --brand-soft-2: #dce7fd;
  --ink: #17181c;
  --ink-2: #5f6575;
  --ink-3: #6b7280;
  --ink-4: #b0b4c0;
  --ok: #16a34a;
  --ok-soft: #ecfdf5;
  --ok-strong: #15803d;
  --warn-strong: #b45309;
  --bad: #dc2626;
  --bad-soft: #fef2f2;
  --bad-strong: #b91c1c;
  --warn: #d97706;
  --warn-soft: #fffbeb;
  --info: #0284c7;
  --info-soft: #f0f9ff;
  --line: #e7e9f0;
  --fill: #f2f3f7;
  --card: #ffffff;
  --soft-bg: #f2f3f7;
  /* 题干关键词高亮 */
  --hl-bg: #fef08a;
  --hl-ink: inherit;
  /* 历史别名（部分页面沿用） */
  --brand-50: var(--brand-soft);
  --ink-1: var(--ink);
  --muted: var(--ink-3);
  --danger: var(--bad);
  --radius: 28rpx;
  /* wot-design-uni 主题对齐品牌蓝 */
  --wot-color-theme: #2e5bff;
  --wot-button-primary-bg-color: #2e5bff;
  --wot-cell-title-fs: 15px;
  background: #f6f7fb;
  color: var(--ink);
  /* 字体栈对齐 @zalize/brand（Inter + 系统中文字体） */
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'PingFang SC', 'HarmonyOS Sans', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif;
}

/* #ifdef H5 */
html {
  /* 恒预留滚动条槽位：内容变长出现滚动条时居中壳不再横移（CLS） */
  scrollbar-gutter: stable;
}
body {
  background: #f6f7fb;
}
body::after {
  /* 禁用 uni-h5 的 shadow-preload：本产品不用 page-head shadow，避免向 dcloud CDN 发第三方请求 */
  animation: none !important;
}
html.theme-dark body {
  background: #15161c;
}
/* 系统「减弱动态效果」：动画/过渡压至瞬时并只跑单次，保留 keyframes 终态 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
/* #endif */

/* 深色模式（三档设置见 theme.js；.theme-dark 挂在 html 上，H5/App 生效）
   深色 token 见 docs/design-v3/features/dark-mode.html：品牌蓝不变，浅底改深底 */
/* #ifdef H5 */
.theme-dark uni-page-body {
  background: #15161c;
  --brand-soft: #1e2a4a;
  --brand-soft-2: #24345c;
  --ink: #f2f3f7;
  --ink-2: #9ba0b0;
  --ink-3: #8a8ea0;
  --ink-4: #5c6070;
  --ok-soft: #0e2b1e;
  --ok-strong: #4ade80;
  --warn-strong: #fbbf24;
  --bad-soft: #331416;
  --bad-strong: #f87171;
  --warn-soft: #33260e;
  --info-soft: #0e2233;
  --line: #2b2e3a;
  --fill: #23252f;
  --card: #1d1f28;
  --soft-bg: #23252f;
  --hl-bg: rgba(250, 204, 21, 0.22);
  --hl-ink: #fde047;
  /* wot-design-uni 深色适配 */
  --wot-color-white: #1d1f28;
  --wot-cell-title-color: #f2f3f7;
  --wot-cell-value-color: #9ba0b0;
  --wot-cell-label-color: #8a8ea0;
  --wot-cell-tap-bg: rgba(255, 255, 255, 0.06);
  --wot-cell-group-title-color: #9ba0b0;
  --wot-color-border-light: #2b2e3a;
  --wot-button-plain-bg-color: transparent;
}
.theme-dark uni-tabbar .uni-tabbar,
.theme-dark uni-tabbar .uni-tabbar__border {
  background: #1d1f28 !important;
  border-color: #2b2e3a;
}
.theme-dark uni-page-head .uni-page-head {
  background: #15161c !important;
  color: #f2f3f7;
}
.theme-dark uni-page-head .uni-page-head__title {
  color: #f2f3f7 !important;
}
.theme-dark uni-page-head .uni-page-head-btn path {
  fill: #f2f3f7;
}
.theme-dark input,
.theme-dark textarea {
  color: var(--ink);
  caret-color: var(--ink);
}
.theme-dark .uni-input-placeholder,
.theme-dark .uni-textarea-placeholder {
  color: var(--ink-4) !important;
}
/* #endif */

/* 桌面/宽屏适配：内容居中限宽 */
/* #ifdef H5 */
@media (min-width: 700px) {
  uni-page-body .wrap {
    max-width: 680px;
    margin: 0 auto;
  }
  uni-page-body {
    font-size: 15px;
  }
}

/* 宽屏（≥768px）：shadcn/ui 风格打磨——细描边卡片 + 轻阴影 + hover 抬升 */
@media (min-width: 768px) {
  uni-page-body .card,
  uni-page-body .stat-c,
  uni-page-body .cellcard {
    border: 1px solid var(--line);
    box-shadow: 0 1px 2px rgba(23, 24, 28, 0.05);
    transition: box-shadow 0.15s ease, transform 0.15s ease;
  }
  uni-page-body .card:hover,
  uni-page-body .stat-c:hover {
    box-shadow: 0 4px 12px rgba(23, 24, 28, 0.1);
    cursor: pointer;
  }
  uni-page-body .searchbar {
    border: 1px solid var(--line);
    box-shadow: none;
  }
  uni-page-body .searchbar:hover {
    border-color: var(--brand);
    cursor: pointer;
  }
}

/* 桌面端：底部 tabbar 变左侧侧栏 */
@media (min-width: 768px) {
  .uni-tabbar {
    top: 0 !important;
    bottom: 0 !important;
    right: auto !important;
    left: 0 !important;
    width: 208px !important;
    height: 100% !important;
    flex-direction: column !important;
    justify-content: flex-start !important;
    padding-top: 32px;
    border-right: 1px solid var(--line);
    box-sizing: border-box;
  }
  .uni-tabbar .uni-tabbar__border {
    display: none;
  }
  .uni-tabbar .uni-tabbar__item {
    flex: none !important;
    width: 100%;
    height: 52px;
  }
  .uni-tabbar .uni-tabbar__bd {
    flex-direction: row !important;
    justify-content: flex-start;
    align-items: center;
    padding: 0 24px;
    gap: 10px;
    height: 52px !important;
  }
  .uni-tabbar .uni-tabbar__label {
    margin-top: 0 !important;
    font-size: 15px !important;
    line-height: 52px !important;
  }
  uni-page-wrapper,
  .uni-tabbar-page {
    padding-left: 208px;
    box-sizing: border-box;
  }
  uni-tabbar + .uni-placeholder {
    display: none;
  }
  uni-page-body .banner,
  uni-page-body .mask {
    left: 208px !important;
  }
}

/* 大桌面（≥1280px）：整体应用壳限宽居中（参考粉笔 1100–1180px），
   侧栏与各固定元素跟随壳体而非视口边缘 */
@media (min-width: 1280px) {
  uni-app {
    max-width: 1140px;
    margin: 0 auto;
    box-shadow: 0 0 0 1px var(--line);
  }
  body {
    overflow-x: hidden;
  }
  .uni-tabbar {
    left: calc((100vw - 1140px) / 2) !important;
  }
  uni-page-body .banner,
  uni-page-body .mask,
  uni-page-body .inputbar,
  uni-page-body .batchbar,
  uni-page-body .navrow {
    left: calc((100vw - 1140px) / 2 + 208px) !important;
    right: calc((100vw - 1140px) / 2) !important;
  }
  uni-page-body .fabmenu {
    right: calc((100vw - 1140px) / 2 + 24px) !important;
  }
}

/* 超宽桌面（≥1366px）：壳体拓至 1280px，内容区 1072px，
   使页面级 1044px 工作台声明真实生效 */
@media (min-width: 1366px) {
  uni-app {
    max-width: 1280px;
  }
  .uni-tabbar {
    left: calc((100vw - 1280px) / 2) !important;
  }
  uni-page-body .banner,
  uni-page-body .mask,
  uni-page-body .inputbar,
  uni-page-body .batchbar,
  uni-page-body .navrow {
    left: calc((100vw - 1280px) / 2 + 208px) !important;
    right: calc((100vw - 1280px) / 2) !important;
  }
  uni-page-body .fabmenu {
    right: calc((100vw - 1280px) / 2 + 24px) !important;
  }
}
/* #endif */
</style>
