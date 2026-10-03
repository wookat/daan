import { ensureAnonUid } from './utils/auth';
import { flushOfflineQueue, watchNetwork } from './utils/offline';
import { installMonitor } from './utils/monitor';
import { installTheme } from './utils/theme';
import { prefetchBoot } from './utils/prefetch';

// Option 类型要求全量回调签名；installMonitor 在 App() 前向同一对象注入
// onError / onPageNotFound，故先断言再补挂。
const appOptions = {
  onLaunch() {
    ensureAnonUid();
    watchNetwork();
    installTheme();
    prefetchBoot();
  },
  onShow() {
    flushOfflineQueue();
  },
} as unknown as WechatMiniprogram.App.Option;

installMonitor(appOptions);
App(appOptions);
