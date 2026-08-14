// H5 离线壳：缓存应用静态资源（页面/脚本/样式/字体），断网时仍能进入应用；
// API 请求不缓存（离线做题由页面内离线题包逻辑处理）。
const CACHE = 'kg-shell-v2';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
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

  // 静态资源（带 hash）：缓存优先，未命中走网络并写入缓存
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (res.type === 'basic' || res.type === 'default')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
