// 前端错误/性能上报：App.onError / onPageNotFound / 慢路由 → POST /api/monitor/report
// （后端转发 zalize-monitor 中心收集器）。对齐 H5 monitor-client.js 口径：
// dedup by message + 每次启动上限，fire-and-forget 绝不影响主链路。
import { BASE_URL } from './request';
import { anonUid } from './auth';

const MAX_PER_LAUNCH = 10;
const seen = new Set<string>();
let sent = 0;

export function reportError(message: string, stack?: string): void {
  const key = String(message || '').slice(0, 200);
  if (seen.has(key) || sent >= MAX_PER_LAUNCH) return;
  seen.add(key);
  sent += 1;
  try {
    wx.request({
      url: BASE_URL + '/api/monitor/report',
      method: 'POST',
      timeout: 8000,
      data: {
        message: String(message || '(no message)').slice(0, 1000),
        stack: stack ? String(stack).slice(0, 4000) : undefined,
        url: 'miniprogram:' + currentRoute(),
      },
      fail: () => {},
    });
  } catch {
    /* 监控绝不影响主链路 */
  }
}

function currentRoute(): string {
  try {
    const pages = getCurrentPages();
    const p = pages[pages.length - 1] as { route?: string } | undefined;
    return (p && p.route) || 'launch';
  } catch {
    return 'unknown';
  }
}

// 慢路由探针：官方 wx.getPerformance 的 route entries（onLoad→onReady 渲染耗时），
// 路由完成后读取，超过阈值上报。优于 patch Page（类型安全、不侵入页面）。
const SLOW_MS = 4000;
const reportedRoutes = new Set<string>();
function checkPerf(): void {
  if (typeof wx.getPerformance !== 'function') return;
  try {
    const perf = wx.getPerformance();
    const entries = perf.getEntriesByType('route') as { name?: string; path?: string; duration?: number; startTime?: number }[];
    for (const e of entries) {
      const route = e.path || e.name || '';
      const key = route + '@' + Math.round(e.startTime || 0);
      if (!route || reportedRoutes.has(key)) continue;
      reportedRoutes.add(key);
      if ((e.duration || 0) >= SLOW_MS) {
        reportError(`slow-page:${route}:${Math.round(e.duration || 0)}ms`, `anonUid=${anonUid()}`);
      }
    }
  } catch {
    /* 性能探针失败静默 */
  }
}

export function installMonitor(appOptions: WechatMiniprogram.App.Option): void {
  const origOnError = appOptions.onError;
  appOptions.onError = function (this: unknown, msg: string) {
    reportError(msg, currentRoute());
    origOnError?.call(this as never, msg);
  };
  const origNotFound = appOptions.onPageNotFound;
  appOptions.onPageNotFound = function (this: unknown, res: WechatMiniprogram.OnPageNotFoundListenerResult) {
    reportError(`page-not-found:${res.path}`, `entry=${res.isEntryPage} query=${JSON.stringify(res.query || {})}`);
    origNotFound?.call(this as never, res);
  };
  wx.onAppRoute(() => {
    // route entry 在切换完成后才有完整 duration
    setTimeout(checkPerf, 500);
  });
}
