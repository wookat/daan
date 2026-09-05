// 前端错误上报客户端：未捕获 JS 错误 / Vue 运行时捕获的错误同源上报 /api/monitor/report，
// 由后端转发中心收集器。纯逻辑无 DOM 依赖，便于单测；发送函数由调用方注入（自带 url）。
const MAX_PER_PAGE = 10;

export function createErrorReporter(send) {
  const seen = new Set();
  let sent = 0;
  return (message, stack) => {
    const key = String(message || '').slice(0, 200);
    if (seen.has(key) || sent >= MAX_PER_PAGE) return false;
    seen.add(key);
    sent += 1;
    try {
      send({ message: String(message || '(no message)').slice(0, 1000), stack: stack ? String(stack).slice(0, 4000) : undefined });
    } catch (e) {
      /* 监控绝不影响主链路 */
    }
    return true;
  };
}

export function classifyVueError(message) {
  if (/Async component timed out/.test(message)) return 'chunk-timeout';
  if (/Failed to fetch dynamically imported module|Unable to preload|Importing a module script failed|Loading chunk/.test(message)) return 'chunk-load';
  return 'vue';
}

// uni h5 每个页面都是 defineAsyncComponent（timeout 由 manifest.h5.async.timeout 决定）：
// 分包 chunk 拉取挂起超时 / 拉取失败（发版后旧 hash 404 等）都只走 Vue handleError → console.error，
// window.onerror / unhandledrejection 均不触发，线上无痕。errorHandler 接管后同时上报并保留控制台输出。
export function installVueErrorHandler(app, report, consoleError) {
  const prev = app.config.errorHandler;
  app.config.errorHandler = (err, instance, info) => {
    const e = err instanceof Error ? err : new Error(String(err));
    report(`vue:${classifyVueError(e.message)}${info ? `:${info}` : ''}: ${e.message}`, e.stack);
    if (typeof consoleError === 'function') consoleError(e);
    if (typeof prev === 'function') prev(err, instance, info);
  };
}
