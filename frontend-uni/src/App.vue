<script>
export default {
  onLaunch: function () {},
  onShow: function () {},
  onHide: function () {},
}
</script>

<style>
/* 全局设计规范 */
page {
  --brand: #4f46e5;
  --brand-soft: #eef2ff;
  --ink: #1f2430;
  --ink-2: #6b7280;
  --ok: #16a34a;
  --ok-soft: #ecfdf5;
  --bad: #dc2626;
  --bad-soft: #fef2f2;
  --line: #e5e7eb;
  --card: #ffffff;
  --soft-bg: #f8f9fc;
  --radius: 24rpx;
  background: linear-gradient(180deg, #eef2ff 0%, #f6f7fb 240rpx, #f6f7fb 100%);
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
/* #endif */
</style>
