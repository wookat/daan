import {
  isBlockedBot,
  isEdgeCacheable,
  edgeTtl,
  cacheFreshness,
  isCacheableContentType,
} from "./edge-policy.js";

const ORIGIN = "https://kaogong-origin.zalize.com";

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), payment=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://career.zalize.com; " +
    "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://cdn.dcloud.net.cn; " +
    "font-src 'self' data: https://at.alicdn.com; connect-src 'self'; object-src 'none'; " +
    "base-uri 'self'; frame-ancestors 'self'; form-action 'self'",
};

// stale-if-error：缓存副本在边缘长存 24h，TTL 过期后仅在回源 5xx/不可达时回退陈旧副本
const STALE_KEEP = 86400;

// 副本自身 Cache-Control 为长存值，对外输出时改回逻辑 TTL，避免下游/浏览器长缓存
function fromCache(hit, ttl, label) {
  const resp = new Response(hit.body, hit);
  resp.headers.set("Cache-Control", `public, max-age=${ttl}`);
  resp.headers.delete("X-Kg-Cached-At");
  resp.headers.set("X-Edge-Cache", label);
  return resp;
}
export async function onRequest({ request, env, waitUntil }) {
  const url = new URL(request.url);
  if (isBlockedBot(url.pathname, request.headers.get("User-Agent"))) {
    return new Response("Forbidden", { status: 403 });
  }
  const cacheable = isEdgeCacheable(
    request.method,
    url.pathname,
    request.headers.has("Authorization"),
    url.searchParams.has("uid")
  );
  const isApi = url.pathname.startsWith("/api/");
  const ttl = edgeTtl(url.pathname);
  // 副本按 STALE_KEEP 长存，逻辑新鲜度由 X-Kg-Cached-At 判定：
  // TTL 内直接 HIT；过期后回源，origin 5xx/不可达时回退陈旧副本（stale-if-error），
  // 消除部署容器重建/autoheal 重启窗口对可缓存 GET 的 502 外泄。
  let stale = null;
  if (cacheable) {
    const hit = await caches.default.match(request.url);
    if (hit) {
      const cachedAt = hit.headers.get("X-Kg-Cached-At");
      if (cacheFreshness(cachedAt, Date.now() / 1000, ttl) === "hit") {
        return fromCache(hit, ttl, "HIT");
      }
      stale = hit;
    }
  }
  const req = new Request(ORIGIN + url.pathname + url.search, request);
  req.headers.set("X-Forwarded-Host", url.hostname);
  // 显式透传真实客户端 IP/UA：Workers 出网会重写 CF-Connecting-IP，
  // 自定义头不受影响，供 origin 访问日志与 slow_load 归因使用
  const clientIp = request.headers.get("CF-Connecting-IP");
  if (clientIp) req.headers.set("X-Kg-Ip", clientIp);
  const clientUa = request.headers.get("User-Agent");
  if (clientUa) req.headers.set("X-Kg-Ua", clientUa);
  // 共享密钥头：origin Caddy 只放行带此头的请求，拒绝绕过边缘缓存的直连爬虫
  if (env.KG_EDGE_KEY) req.headers.set("X-Kg-Edge", env.KG_EDGE_KEY);
  let upstream;
  try {
    upstream = await fetch(req);
  } catch (e) {
    if (stale) return fromCache(stale, ttl, "STALE");
    throw e;
  }
  if (stale && upstream.status >= 500) return fromCache(stale, ttl, "STALE");
  const resp = new Response(upstream.body, upstream);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) resp.headers.set(k, v);
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/")) {
    resp.headers.set("X-Robots-Tag", "noindex, nofollow");
  } else {
    resp.headers.delete("X-Robots-Tag");
  }
  const ctOk = isCacheableContentType(url.pathname, isApi, resp.headers.get("content-type"));
  if (cacheable && resp.status === 200 && ctOk) {
    const [body, cacheBody] = resp.body.tee();
    const cacheCopy = new Response(cacheBody, resp);
    // 副本长存 24h 供 stale-if-error 兜底；对外新鲜度由 X-Kg-Cached-At + TTL 判定
    cacheCopy.headers.set("Cache-Control", `public, max-age=${STALE_KEEP}`);
    cacheCopy.headers.set("X-Kg-Cached-At", String(Math.floor(Date.now() / 1000)));
    cacheCopy.headers.delete("Set-Cookie");
    waitUntil(caches.default.put(request.url, cacheCopy));
    const out = new Response(body, resp);
    out.headers.set("Cache-Control", `public, max-age=${ttl}`);
    out.headers.set("X-Edge-Cache", "MISS");
    return out;
  }
  return resp;
}
