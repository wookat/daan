// PWA 安装入口：尽早暂存 beforeinstallprompt（Chromium 系），供「我的」页安装 cell 使用。
// 非 H5 平台无 window，所有入口均有守卫，导出保持可用。
let deferred = null;
const listeners = [];

function notify() {
  listeners.forEach((cb) => {
    try { cb(); } catch (e) { /* 忽略订阅方异常 */ }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export function canInstall() {
  if (!deferred) return false;
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return false;
  return true;
}

export async function promptInstall() {
  if (!deferred) return 'unavailable';
  const e = deferred;
  deferred = null;
  notify();
  e.prompt();
  const choice = await e.userChoice;
  return choice && choice.outcome; // 'accepted' | 'dismissed'
}

export function onInstallable(cb) {
  listeners.push(cb);
  return () => {
    const i = listeners.indexOf(cb);
    if (i >= 0) listeners.splice(i, 1);
  };
}
