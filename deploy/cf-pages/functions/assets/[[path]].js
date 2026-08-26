// /assets/* 静态资源守卫：未命中时返回 404（no-store），
// 禁止 SPA HTML 回退被 immutable 长缓存固化（缓存投毒防护）。
export async function onRequest({ request, env }) {
  const resp = await env.ASSETS.fetch(request);
  const ct = resp.headers.get("content-type") || "";
  if (resp.ok && !ct.includes("text/html")) return resp;
  return new Response("Not Found", {
    status: 404,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}
