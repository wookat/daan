// 路由 chunk 空闲预取：静态资源为 immutable 长缓存且不经 SW 拦截，
// 一次普通 fetch 即可长期驻留 HTTP 缓存，离线时浏览器直接命中，
// 从而离线也能直入未访问过的路由。守卫：省流/2g/离线跳过，同版本只跑一轮。
const DONE_KEY = 'kg_precache_done';

async function run() {
  try {
    const c = navigator.connection;
    if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return;
    if (!navigator.onLine) return;
    const res = await fetch('/precache.json');
    if (!res.ok) return;
    const list = await res.json();
    if (!Array.isArray(list) || !list.length) return;
    const sig = `${list.length}:${list[list.length - 1]}`;
    if (localStorage.getItem(DONE_KEY) === sig) return;
    for (const url of list) {
      if (!navigator.onLine) return;
      await fetch(url, { cache: 'default' });
    }
    localStorage.setItem(DONE_KEY, sig);
  } catch (e) {
    /* 预取失败不影响主链路 */
  }
}

export function initRoutePrecache() {
  if (typeof window === 'undefined') return;
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 10000 });
      else run();
    }, 8000);
  });
}
