<script>
// #ifdef H5
import { initReminderLoop } from './reminder.js'
// #endif

export default {
  onLaunch: function () {
    // #ifdef H5
    const h = window.location.hash || ''
    const m = h.match(/^#\/pages\/(exam|shenlun|user)\//)
    if (m) window.location.replace(window.location.pathname + h.replace('#/pages/', '#/pkgA/'))
    initReminderLoop()
    // #endif
  },
  onShow: function () {},
  onHide: function () {},
}
</script>

<style>
/* 全局设计规范 */
page {
  /* design-v3 tokens（docs/design-v3/DESIGN.md） */
  --brand: #3b6ff5;
  --brand-soft: #edf3fe;
  --brand-soft-2: #dce7fd;
  --ink: #17181c;
  --ink-2: #7d818f;
  --ink-3: #8f959e;
  --ink-4: #b0b4c0;
  --ok: #16a34a;
  --ok-soft: #ecfdf5;
  --bad: #dc2626;
  --bad-soft: #fef2f2;
  --warn: #d97706;
  --warn-soft: #fffbeb;
  --line: #e7e9f0;
  --fill: #f2f3f7;
  --card: #ffffff;
  --soft-bg: #f2f3f7;
  --radius: 28rpx;
  background: linear-gradient(180deg, #edf3fe 0%, #f6f7fb 240rpx, #f6f7fb 100%);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
}

/* 深色模式（H5，跟随系统） */
/* #ifdef H5 */
@media (prefers-color-scheme: dark) {
  page {
    --brand-soft: #2b2d55;
    --ink: #e7e9f0;
    --ink-2: #9aa0b0;
    --ok-soft: #10301f;
    --bad-soft: #3a1414;
    --line: #363a48;
    --card: #23262f;
    --soft-bg: #1c1f27;
    background: linear-gradient(180deg, #1b1d33 0%, #14161c 240rpx, #14161c 100%);
  }
  uni-tabbar .uni-tabbar,
  uni-tabbar .uni-tabbar__border {
    background: #1c1f27 !important;
    border-color: #363a48;
  }
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
/* #endif */
</style>
