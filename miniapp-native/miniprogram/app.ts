import { ensureAnonUid } from './utils/auth';
import { flushOfflineQueue, watchNetwork } from './utils/offline';

App({
  onLaunch() {
    ensureAnonUid();
    watchNetwork();
  },
  onShow() {
    flushOfflineQueue();
  },
});
