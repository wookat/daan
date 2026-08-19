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

export async function onRequest({ request }) {
  const url = new URL(request.url);
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
  return resp;
}
