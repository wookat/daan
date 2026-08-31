// H5 离线壳：仅缓存 SPA 壳（/），静态资源走 HTTP immutable 长缓存；
// API 请求不缓存（离线做题由页面内离线题包逻辑处理）。
const CACHE = 'kg-shell-v4';

self.addEventListener('install', (e) => {
  // cache:'reload' 绕过 HTTP 缓存，保证入库的壳是最新 HTML
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add(new Request('/', { cache: 'reload' })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      // 通知受控页面：SW 已更新，页面可比对 bundle hash 决定是否自愈 reload
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((cs) => cs.forEach((cl) => cl.postMessage({ type: 'kg-sw-updated' })))
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  // 服务端页面（管理台/SEO 落地页）不属于 SPA 壳，不拦截
  if (
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/tiku') ||
    url.pathname.startsWith('/s/')
  )
    return;

  // SPA 导航：网络优先（带超时兑底，防 SW 挂起拖死整站导航），断网/超时回退缓存壳
  if (req.mode === 'navigate') {
    e.respondWith(
      Promise.race([
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('sw-nav-timeout')), 8000)),
      ]).catch(() => caches.match('/').then((hit) => hit || fetch(req)))
    );
    return;
  }

  // 静态资源（带 hash）不拦截：immutable 长缓存由 HTTP 缓存承担；
  // SW 内 Cache Storage 偶发挂起时连兜底 fetch 都发不出去，不 respondWith 让浏览器原生处理，挂起面归零
});

// Web Push：每日一练提醒（payload 由后端 push_api 下发 {title, body, url}）
self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch (err) {
    d = {};
  }
  e.waitUntil(
    self.registration.showNotification(d.title || '错题邦', {
      body: d.body || '',
      icon: '/static/logo.png',
      badge: '/static/logo.png',
      data: { url: d.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
