import {
  isBlockedBot,
  isEdgeCacheable,
  edgeTtl,
  cacheFreshness,
  isCacheableContentType,
  serveMode,
  notModified,
  carryLastModified,
  shouldRetryOrigin,
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

// 缓存副本在边缘长存 24h：TTL 过期后先回陈旧副本并后台刷新（stale-while-revalidate），
// 后台刷新失败/5xx 时保留旧副本继续兜底（stale-if-error）
const STALE_KEEP = 86400;

// 副本自身 Cache-Control 为长存值，对外输出时改回逻辑 TTL，避免下游/浏览器长缓存
function fromCache(hit, ttl, label, request) {
  // 副本带 origin 内容指纹 ETag：命中条件请求直接 304 空 body，不重传 SSR HTML
  if (
    request &&
    notModified(
      request.headers.get("If-None-Match"),
      request.headers.get("If-Modified-Since"),
      hit.headers.get("ETag"),
      hit.headers.get("Last-Modified")
    )
  ) {
    const h = new Headers();
    for (const k of ["ETag", "Last-Modified"]) {
      const v = hit.headers.get(k);
      if (v) h.set(k, v);
    }
    h.set("Cache-Control", `public, max-age=${ttl}`);
    h.set("X-Edge-Cache", label);
    return new Response(null, { status: 304, headers: h });
  }
  const resp = new Response(hit.body, hit);
  resp.headers.set("Cache-Control", `public, max-age=${ttl}`);
  resp.headers.delete("X-Kg-Cached-At");
  resp.headers.set("X-Edge-Cache", label);
  return resp;
}

// 安全头 + robots 语义：前台直出与后台刷新入缓存的副本共用，保证两条路径逐字节同构
function decorate(resp, pathname) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) resp.headers.set(k, v);
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/")) {
    resp.headers.set("X-Robots-Tag", "noindex, nofollow");
  } else {
    resp.headers.delete("X-Robots-Tag");
  }
  return resp;
}

// 长存副本：Cache-Control 为 STALE_KEEP，对外新鲜度由 X-Kg-Cached-At + TTL 判定
function toCacheCopy(body, resp) {
  const copy = new Response(body, resp);
  copy.headers.set("Cache-Control", `public, max-age=${STALE_KEEP}`);
  copy.headers.set("X-Kg-Cached-At", String(Math.floor(Date.now() / 1000)));
  copy.headers.delete("Set-Cookie");
  return copy;
}

// HTML 的 ETag 会被 Cloudflare 前端（Email Obfuscation 内容改写）剥离，
// Last-Modified 是其唯一对客验证器：内容指纹未变时沿用旧副本的 Last-Modified，
// 保证验证器跨副本刷新稳定（If-Modified-Since 不被 TTL 周期性清零）
function stampLastModified(resp, prev) {
  if (!resp.headers.get("Last-Modified")) {
    resp.headers.set(
      "Last-Modified",
      carryLastModified(
        prev && prev.headers.get("ETag"),
        prev && prev.headers.get("Last-Modified"),
        resp.headers.get("ETag"),
        Date.now()
      )
    );
  }
  return resp;
}

// 后台回源刷新副本：200 且 content-type 合法才覆盖，失败保留旧副本（stale-if-error）
async function revalidate(req, cacheKey, pathname, isApi, prev) {
  let upstream;
  try {
    upstream = await fetch(req);
  } catch {
    return;
  }
  const resp = decorate(new Response(upstream.body, upstream), pathname);
  const ctOk = isCacheableContentType(pathname, isApi, resp.headers.get("content-type"));
  if (resp.status !== 200 || !ctOk) return;
  await caches.default.put(cacheKey, toCacheCopy(resp.body, stampLastModified(resp, prev)));
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
  // TTL 内直接 HIT；过期且有副本先回陈旧副本并后台刷新（swr）；无副本才同步回源。
  let stale = null;
  let mode = "fetch";
  if (cacheable) {
    const hit = await caches.default.match(request.url);
    const cachedAt = hit && hit.headers.get("X-Kg-Cached-At");
    mode = serveMode(!!hit, cacheFreshness(cachedAt, Date.now() / 1000, ttl));
    if (mode === "hit") return fromCache(hit, ttl, "HIT", request);
    stale = hit;
  }
  const req = new Request(ORIGIN + url.pathname + url.search, request);
  req.headers.set("X-Forwarded-Host", url.hostname);
  // 回源请求剥离条件头：确保拿到 200 全量以刷新/建立副本（条件评估在边缘完成）
  req.headers.delete("If-None-Match");
  req.headers.delete("If-Modified-Since");
  // 显式透传真实客户端 IP/UA：Workers 出网会重写 CF-Connecting-IP，
  // 自定义头不受影响，供 origin 访问日志与 slow_load 归因使用
  const clientIp = request.headers.get("CF-Connecting-IP");
  if (clientIp) req.headers.set("X-Kg-Ip", clientIp);
  const clientUa = request.headers.get("User-Agent");
  if (clientUa) req.headers.set("X-Kg-Ua", clientUa);
  // 共享密钥头：origin Caddy 只放行带此头的请求，拒绝绕过边缘缓存的直连爬虫
  if (env.KG_EDGE_KEY) req.headers.set("X-Kg-Edge", env.KG_EDGE_KEY);
  // stale-while-revalidate：立即回陈旧副本，后台回源刷新，用户不等待 origin 长尾
  if (mode === "swr") {
    waitUntil(revalidate(req, request.url, url.pathname, isApi, stale));
    return fromCache(stale, ttl, "REVALIDATE", request);
  }
  // 无副本 MISS 且 origin 处于容器重启窗口（fetch 异常/502–504）时单次退避重试：
  // 深页无边缘副本可退，不重试则 5xx 直漏给用户/爬虫
  let upstream = null;
  for (let attempt = 0; ; attempt++) {
    let status = 0;
    try {
      upstream = await fetch(attempt === 0 ? req : req.clone());
      status = upstream.status;
    } catch (e) {
      if (stale) return fromCache(stale, ttl, "STALE", request);
      if (!shouldRetryOrigin(request.method, 0, !!stale, attempt)) throw e;
      upstream = null;
    }
    if (upstream && stale && status >= 500) return fromCache(stale, ttl, "STALE", request);
    if (upstream && !shouldRetryOrigin(request.method, status, !!stale, attempt)) break;
    if (upstream && upstream.body) waitUntil(upstream.body.cancel().catch(() => {}));
    await new Promise((r) => setTimeout(r, 1200));
  }
  const resp = decorate(new Response(upstream.body, upstream), url.pathname);
  const ctOk = isCacheableContentType(url.pathname, isApi, resp.headers.get("content-type"));
  if (cacheable && resp.status === 200 && ctOk) {
    stampLastModified(resp, stale);
    const [body, cacheBody] = resp.body.tee();
    waitUntil(caches.default.put(request.url, toCacheCopy(cacheBody, resp)));
    // 无副本但 origin 新鲜响应指纹与客户端持有一致：仍可 304（body 已 tee 入缓存）
    if (
      notModified(
        request.headers.get("If-None-Match"),
        request.headers.get("If-Modified-Since"),
        resp.headers.get("ETag"),
        resp.headers.get("Last-Modified")
      )
    ) {
      const h = new Headers();
      for (const k of ["ETag", "Last-Modified"]) {
        const v = resp.headers.get(k);
        if (v) h.set(k, v);
      }
      h.set("Cache-Control", `public, max-age=${ttl}`);
      h.set("X-Edge-Cache", "MISS");
      waitUntil(body.pipeTo(new WritableStream()));
      return new Response(null, { status: 304, headers: h });
    }
    const out = new Response(body, resp);
    out.headers.set("Cache-Control", `public, max-age=${ttl}`);
    out.headers.set("X-Edge-Cache", "MISS");
    return out;
  }
  return resp;
}
