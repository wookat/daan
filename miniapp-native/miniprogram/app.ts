import { ensureAnonUid } from './utils/auth';

App({
  onLaunch() {
    ensureAnonUid();
  },
});
