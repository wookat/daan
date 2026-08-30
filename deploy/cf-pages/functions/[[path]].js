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

// /tiku* 为纯公开 SEO 页族（不随登录态/UA 变化），在边缘缓存 5 分钟，
// 避免每个请求（含爬虫抓取）穿透到共享 origin 产生长尾 TTFB。
const EDGE_CACHE_TTL = 300;

// uid 无关的公开只读 API（响应确定、不随登录态变化），短 TTL 边缘缓存，
// 屏蔽共享 origin 的长尾抖动；带 Authorization/uid 的请求一律绕过。
const API_EDGE_CACHE_TTL = 60;
const API_CACHE_ALLOWLIST = new Set([
  "/api/announcement",
  "/api/question_counts",
  "/api/submodules",
  "/api/real_filters",
  "/api/papers",
  "/api/comments/plaza",
]);

function isEdgeCacheable(request, url) {
  if (request.method !== "GET") return false;
  if (url.pathname.startsWith("/tiku")) return true;
  return (
    API_CACHE_ALLOWLIST.has(url.pathname) &&
    !request.headers.has("Authorization") &&
    !url.searchParams.has("uid")
  );
}

export async function onRequest({ request, waitUntil }) {
  const url = new URL(request.url);
  const cacheable = isEdgeCacheable(request, url);
  if (cacheable) {
    const hit = await caches.default.match(request.url);
    if (hit) {
      const resp = new Response(hit.body, hit);
      resp.headers.set("X-Edge-Cache", "HIT");
      return resp;
    }
  }
  const req = new Request(ORIGIN + url.pathname + url.search, request);
  req.headers.set("X-Forwarded-Host", url.hostname);
  const upstream = await fetch(req);
  const resp = new Response(upstream.body, upstream);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) resp.headers.set(k, v);
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/")) {
    resp.headers.set("X-Robots-Tag", "noindex, nofollow");
  } else {
    resp.headers.delete("X-Robots-Tag");
  }
  const isApi = url.pathname.startsWith("/api/");
  const ctOk = (resp.headers.get("content-type") || "").includes(
    isApi ? "application/json" : "text/html"
  );
  if (cacheable && resp.status === 200 && ctOk) {
    const ttl = isApi ? API_EDGE_CACHE_TTL : EDGE_CACHE_TTL;
    const [body, cacheBody] = resp.body.tee();
    const cacheCopy = new Response(cacheBody, resp);
    cacheCopy.headers.set("Cache-Control", `public, max-age=${ttl}`);
    cacheCopy.headers.delete("Set-Cookie");
    waitUntil(caches.default.put(request.url, cacheCopy));
    const out = new Response(body, resp);
    out.headers.set("Cache-Control", `public, max-age=${ttl}`);
    out.headers.set("X-Edge-Cache", "MISS");
    return out;
  }
  return resp;
}
