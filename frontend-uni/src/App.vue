<script>
// #ifdef H5
import { initReminderLoop } from './reminder.js'
import { installSheetHistory } from './sheet-history.js'
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
    installSheetHistory(this.$router)
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
        h1.textContent = (headTitle || document.title || '').trim() || '答岸'
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
/* 设计 token：唯一来源 tools/design-tokens/tokens.json，改完跑 node tools/design-tokens/build.mjs。
   生成文件含 semantic/scale/component/module 变量、深色映射（.theme-dark uni-page-body）、
   wot-design-uni 主题变量、deprecated 别名与 .num/.q-text/.safe-b 工具类。回滚 = 删下面这一行。 */
@import './styles/tokens.generated.css';

page {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-sans);
}

/* wd-segmented 项视觉高 28/32/24（wot 默认，无高度变量），命中区同 KgButton sm/md 用 ::after 上下扩到 --hit-min；
   选中底块是兄弟 .wd-segmented__item--active，不受影响 */
.wd-segmented__item::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: var(--hit-min);
  transform: translateY(-50%);
}
/* wd-search 「取消」高 30 / 清空 ✕ 约 28：同法扩到 --hit-min（外层 wd-search 上下 padding 10 本就留了位） */
.wd-search__cancel {
  position: relative;
}
.wd-search__cancel::after,
.wd-search__clear::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: var(--hit-min);
  transform: translateY(-50%);
}

/* wot 未开放变量的硬编码底色（wd-popup #fff / picker roller rgba(245,245,245)）：写在 scoped 选择器上，只能提权覆盖到语义 token */
.wd-popup-wrapper .wd-popup {
  background: var(--card) !important;
}
.wd-picker-view .wd-picker-view__roller {
  background: var(--fill) !important;
}
/* wot 1.14 的 $-picker-mask 是空格分隔的双 gradient（缺逗号），整条 background 无效，滚轮上下渐隐一直没渲染；这里按上/下半区各铺一层 */
.wd-picker-view .wd-picker-view__mask {
  background:
    linear-gradient(180deg, var(--card-fade), var(--card-fade-2)) top / 100% 50% no-repeat,
    linear-gradient(0deg, var(--card-fade), var(--card-fade-2)) bottom / 100% 50% no-repeat !important;
}

/* #ifdef H5 */
/* uni-h5 壳：page-head/tabbar 998、原生 toast/modal 999；遮罩+sheet 走 --z-overlay 压过壳，原生反馈层再抬到 --z-toast */
uni-toast,
uni-modal,
uni-actionsheet .uni-mask,
uni-actionsheet .uni-actionsheet {
  z-index: var(--z-toast) !important;
}
/* 隐藏浏览器默认滚动条：滚动功能保留、条体不渲染，对齐小程序无滚动条体感 */
* {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
*::-webkit-scrollbar {
  display: none;
}
body {
  background: var(--bg);
  /* uni-modal/uni-toast/uni-actionsheet 挂在 uni-page 之外，page 选择器的字体规则覆盖不到 */
  font-family: var(--font-sans);
}
body::after {
  /* 禁用 uni-h5 的 shadow-preload：本产品不用 page-head shadow，避免向 dcloud CDN 发第三方请求 */
  animation: none !important;
}
html.theme-dark body {
  background: var(--bg);
}
/* #endif */

/* 深色模式（三档设置见 theme.js；.theme-dark 挂在 html 上，H5/App 生效）
   深色 token 值在 tokens.generated.css（page + :root 镜像），uni 运行时壳（tabbar/page-head）在 uni-page-body 之外，靠 :root 镜像读 token */
/* #ifdef H5 */
.theme-dark uni-page-body {
  background: var(--bg);
  /* wot 深色微调（其余 wot 变量已在生成文件里指向语义 token，自动跟随） */
  --wot-cell-tap-bg: rgba(255, 255, 255, 0.06);
  --wot-button-plain-bg-color: transparent;
}
.theme-dark uni-tabbar .uni-tabbar,
.theme-dark uni-tabbar .uni-tabbar__border {
  background: var(--card) !important;
  border-color: var(--line);
}
/* tabbar 文字色为 pages.json 静态配置的内联样式（uni-h5 无 setTabBarStyle），按配置色值定向覆盖 */
.theme-dark uni-tabbar .uni-tabbar__label {
  color: var(--ink-3) !important;
}
.theme-dark uni-tabbar .uni-tabbar__label[style*='rgb(46, 91, 255)'] {
  color: var(--brand-text) !important;
}
/* tabbar 图标为浅色主题静态 PNG（选中蓝 #3060f0 深底偏沉、未选灰偏暗），深色下滤镜提亮对齐 --brand-text/--ink-2 色感 */
.theme-dark uni-tabbar .uni-tabbar__icon img {
  filter: brightness(1.25);
}
.theme-dark uni-tabbar .uni-tabbar__icon img[src*='-on'] {
  filter: saturate(0.6) brightness(1.45);
}
.theme-dark uni-page-head .uni-page-head {
  background: var(--bg) !important;
  color: var(--ink);
}
.theme-dark uni-page-head .uni-page-head__title {
  color: var(--ink) !important;
}
.theme-dark uni-page-head .uni-page-head-btn path {
  fill: var(--ink);
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
/* 原生 uni.showModal：uni-h5 写死 #fff/#999 且按钮色走 cancelColor/confirmColor 内联 style（#000/#007aff），不随 .theme-dark；全仓无调用传 *Color，故 !important 覆盖 */
.theme-dark uni-modal .uni-modal {
  background: var(--card);
  color: var(--ink);
}
.theme-dark uni-modal .uni-modal__bd {
  color: var(--ink-2);
}
.theme-dark uni-modal .uni-modal__textarea {
  background: var(--fill);
  color: var(--ink);
}
.theme-dark uni-modal .uni-modal__ft::after,
.theme-dark uni-modal .uni-modal__btn::after {
  border-color: var(--line);
}
.theme-dark uni-modal .uni-modal__btn {
  color: var(--ink) !important;
  border-color: var(--line);
}
.theme-dark uni-modal .uni-modal__btn:active {
  background: var(--fill);
}
.theme-dark uni-modal .uni-modal__btn_primary {
  color: var(--brand-text) !important;
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

/* 宽屏（≥768px）：细描边，不叠阴影 */
@media (min-width: 768px) {
  uni-page-body .cellcard {
    border: 1px solid var(--line);
  }
  uni-page-body .searchbar {
    border: 1px solid var(--line);
    box-shadow: none;
  }
  uni-page-body .searchbar:hover {
    border-color: var(--brand-text);
    cursor: pointer;
  }
}

/* 桌面端：底部 tabbar 变左侧侧栏；208px 让位只给 tab 页（uni-page[type="tabBar"]），非 tab 页无侧栏不留空栏 */
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
  uni-page[type="tabBar"] uni-page-wrapper {
    padding-left: 208px;
    box-sizing: border-box;
  }
  uni-tabbar + .uni-placeholder {
    display: none;
  }
  uni-page[type="tabBar"] uni-page-body .banner,
  uni-page[type="tabBar"] uni-page-body .mask {
    left: 208px !important;
  }
}

/* 大桌面（≥1280px）：整体应用壳限宽居中（参考粉笔 1100–1180px），
   侧栏与各固定元素跟随壳体而非视口边缘 */
@media (min-width: 1280px) {
  uni-app {
    max-width: 1140px;
    margin: 0 auto;
    /* 只描左右两条竖边作壳体分界；0 0 0 1px 整圈会在页面上下两端露出灰色横线 */
    box-shadow: 1px 0 0 var(--line), -1px 0 0 var(--line);
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
    left: calc((100vw - 1140px) / 2) !important;
    right: calc((100vw - 1140px) / 2) !important;
  }
  uni-page[type="tabBar"] uni-page-body .banner,
  uni-page[type="tabBar"] uni-page-body .mask,
  uni-page[type="tabBar"] uni-page-body .inputbar,
  uni-page[type="tabBar"] uni-page-body .batchbar,
  uni-page[type="tabBar"] uni-page-body .navrow {
    left: calc((100vw - 1140px) / 2 + 208px) !important;
  }
  uni-page-body .fabmenu {
    right: calc((100vw - 1140px) / 2 + 24px) !important;
  }
}

/* 超宽桌面（≥1366px）：壳体弹性拓宽至 1400px，两侧保底 40px 呼吸边距，
   侧栏与各固定元素跟随壳体边缘而非视口边缘 */
@media (min-width: 1366px) {
  uni-app {
    max-width: 1400px;
    width: calc(100vw - 80px);
  }
  .uni-tabbar {
    left: max(40px, calc((100vw - 1400px) / 2)) !important;
  }
  uni-page-body .banner,
  uni-page-body .mask,
  uni-page-body .inputbar,
  uni-page-body .batchbar,
  uni-page-body .navrow {
    left: max(40px, calc((100vw - 1400px) / 2)) !important;
    right: max(40px, calc((100vw - 1400px) / 2)) !important;
  }
  uni-page[type="tabBar"] uni-page-body .banner,
  uni-page[type="tabBar"] uni-page-body .mask,
  uni-page[type="tabBar"] uni-page-body .inputbar,
  uni-page[type="tabBar"] uni-page-body .batchbar,
  uni-page[type="tabBar"] uni-page-body .navrow {
    left: max(248px, calc((100vw - 1400px) / 2 + 208px)) !important;
  }
  uni-page-body .fabmenu {
    right: max(64px, calc((100vw - 1400px) / 2 + 24px)) !important;
  }
}
/* #endif */
</style>
