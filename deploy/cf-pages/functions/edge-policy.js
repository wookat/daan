// 边缘决策纯函数：与 [[path]].js 的 IO 编排分离，可被 vitest 直接单测。

// /tiku* 为纯公开 SEO 页族（不随登录态/UA 变化），在边缘缓存 5 分钟，
// 避免每个请求（含爬虫抓取）穿透到共享 origin 产生长尾 TTFB。
export const EDGE_CACHE_TTL = 300;

// uid 无关的公开只读 API（响应确定、不随登录态变化），短 TTL 边缘缓存，
// 屏蔽共享 origin 的长尾抖动；带 Authorization/uid 的请求一律绕过。
export const API_EDGE_CACHE_TTL = 60;

export const API_CACHE_ALLOWLIST = new Set([
  "/api/announcement",
  "/api/question_counts",
  "/api/daily_set",
  "/api/submodules",
  "/api/real_filters",
  "/api/papers",
  "/api/comments/plaza",
]);

// 无获客价值的商业爬虫（舆情/SEO 工具）：每条 /tiku/q/* URL 各异使边缘缓存失效，
// 全部穿透共享 origin SSR；在边缘直接 403，robots.txt 放行以便其读到禁抓声明。
const BLOCKED_BOT_UA = /awariobot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot/i;

export function isBlockedBot(pathname, ua) {
  return pathname !== "/robots.txt" && BLOCKED_BOT_UA.test(ua || "");
}

export function isEdgeCacheable(method, pathname, hasAuth, hasUid) {
  if (method !== "GET") return false;
  if (pathname.startsWith("/tiku")) return true;
  // /s/* 分享落地页：输出仅依赖 sid（OG + 跳 SPA），动态内容都在 SPA 内走 API
  if (pathname.startsWith("/s/")) return true;
  if (pathname.startsWith("/p/")) return true;
  if (pathname.startsWith("/sitemap") || pathname === "/robots.txt") return true;
  return API_CACHE_ALLOWLIST.has(pathname) && !hasAuth && !hasUid;
}

export function edgeTtl(pathname) {
  return pathname.startsWith("/api/") ? API_EDGE_CACHE_TTL : EDGE_CACHE_TTL;
}

// 副本按 STALE_KEEP 长存，逻辑新鲜度由 X-Kg-Cached-At 判定：
// TTL 内 'hit'；过期 'stale'（回源，origin 5xx/不可达时才回退该陈旧副本）。
export function cacheFreshness(cachedAt, nowSec, ttl) {
  return nowSec - Number(cachedAt || 0) <= ttl ? "hit" : "stale";
}

export function isCacheableContentType(pathname, isApi, contentType) {
  const ct = contentType || "";
  if (pathname.startsWith("/sitemap") || pathname === "/robots.txt") {
    return ct.includes("xml") || ct.includes("text/plain");
  }
  return ct.includes(isApi ? "application/json" : "text/html");
}
