// 把 '/#/...' 相对根路径拼回当前 pathname（例如 /app/#/pages/book/book），
// 防止 history.replaceState 把 H5 子路径 /app/ 抹成 /（进而引发相对静态资源绕过 CF Pages 缓存）。
export function withBasePath(hashUrl, pathname) {
  if (typeof hashUrl !== 'string' || !hashUrl) return hashUrl;
  const i = hashUrl.indexOf('#');
  if (i < 0) return hashUrl;
  const base = pathname || (typeof window !== 'undefined' && window.location && window.location.pathname) || '/';
  return base + hashUrl.slice(i);
}
