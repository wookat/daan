import {
	createSSRApp
} from "vue";
import App from "./App.vue";

// #ifdef H5
import "./pwa.js"; // 尽早注册 beforeinstallprompt 监听，供「我的」页安装入口使用
import { normalizeDailyDeepLink } from "./deeplink.js";
import { initKeyboardFocus } from "./a11y-focus.js";
import { initA11yLive } from "./a11y-live.js";
import { initRoutePrecache } from "./precache.js";
import { createErrorReporter, installVueErrorHandler } from "./monitor-client.js";
initKeyboardFocus(); // 必须先于 app 挂载：拦截 Vue runtime 的 click addEventListener
initA11yLive();
initRoutePrecache();

// 集中式错误监控（审计 P1-7）：未捕获 JS 错误同源上报 /api/monitor/report，由后端转发中心收集器
let mReport = () => false;
if (typeof window !== 'undefined') {
	mReport = createErrorReporter(({ message, stack }) => {
		const body = JSON.stringify({ message, stack, url: location.href });
		if (navigator.sendBeacon) {
			navigator.sendBeacon('/api/monitor/report', new Blob([body], { type: 'application/json' }));
		} else {
			fetch('/api/monitor/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
		}
	});
	window.addEventListener('error', (e) => {
		mReport(e.message || 'window.onerror', e.error && e.error.stack);
	});
	window.addEventListener('unhandledrejection', (e) => {
		const r = e.reason;
		if (r && r.stack) mReport(`unhandledrejection: ${r.message || r}`, r.stack);
		else mReport(`unhandledrejection: ${String(r).slice(0, 500)}`);
	});
}

// 根路径查询深链归一化：/?daily=1[&date=…] 是对外短链（推送/分享），uni h5 router 只识别 hash 路由，启动前改写为练习页 hash 深链
if (typeof window !== 'undefined') {
	try {
		const target = normalizeDailyDeepLink(location.search, location.hash);
		if (target) location.replace(location.origin + location.pathname + target);
	} catch (e) { /* 归一化失败保持原状 */ }
}

// 未匹配路由兜底：无效/过期深链在 uni h5 router 无匹配时渲染为永久白屏，回落首页
if (typeof window !== 'undefined') {
	window.addEventListener('load', () => {
		try {
			const path = ((location.hash || '#/').slice(1).split('?')[0]) || '/';
			const routes = window.__uniRoutes || [];
			const known = routes.some((r) => r.path === path || r.alias === path);
			if (!known) location.replace(location.origin + location.pathname + '#/');
		} catch (e) { /* 兜底失败保持原状 */ }
	});
}

// 离线壳：缓存静态资源，断网时仍能进入应用（离线做题依赖已下载题包）
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && location.protocol !== 'file:') {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/sw.js').then((reg) => {
			// 主动校验 SW 更新：回前台即触发（浏览器自身校验最长间隔 24h，发版后存量用户尽快吃到新壳）
			let last = 0;
			const check = () => {
				const now = Date.now();
				if (now - last < 60000) return;
				last = now;
				reg.update().catch(() => {});
			};
			check();
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible') check();
			});
		}).catch(() => {});
	});
}

// 可观测性与陈旧壳自愈：不依赖 SW，覆盖国内 App 内置 webview 等无 SW 环境
if (typeof window !== 'undefined') {
	window.addEventListener('load', () => {
		// 当前运行 bundle 的 hash 段（主 chunk 文件名），用于 RUM 版本戳与陈旧壳自愈比对
		const runningHash = () => {
			try {
				const s = document.querySelector('script[src*="/assets/index-"]');
				const m = s && s.src.match(/index-([\w-]+)\.js/);
				return m ? m[1] : '';
			} catch (e) { return ''; }
		};
		// boot 版本心跳：每客户端每日至多 1 条，度量活跃客户端的 bundle 版本分布（陈旧壳自愈效果/功能投放面分母）
		setTimeout(() => {
			try {
				const day = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
				if (localStorage.getItem('kg_boot_day') === day) return;
				localStorage.setItem('kg_boot_day', day);
				const sw = navigator.serviceWorker && navigator.serviceWorker.controller ? 1 : 0;
				import('./api.js').then(({ trackEvent }) => trackEvent('boot', 'h5', `v:${runningHash() || '-'};sw:${sw}`));
			} catch (e) { /* 心跳失败不影响主流程 */ }
		}, 6000);
		// 慢加载 RUM：偶发 ~40s 壳/chunk 长尾在服务端无痕（疑 SW/客户端侧），上报导航与最慢资源耗时取证。
		// 5s 首查 + 65s 复查（捕捉 40s 级迟到完成的资源，只上报一次）
		let rumSent = false;
		const rumCheck = () => {
			if (rumSent) return;
			try {
				const nav = performance.getEntriesByType('navigation')[0];
				const worst = performance
					.getEntriesByType('resource')
					.filter((r) => r.duration > 8000)
					.sort((a, b) => b.duration - a.duration)[0];
				if ((!nav || nav.duration < 10000) && !worst) return;
				rumSent = true;
				const part = (e) => `${(e.name || 'nav').split('/').pop().split('?')[0].slice(0, 48)}:${Math.round(e.duration)}`;
				// 阶段拆解：ttfb=文档首字节（边缘/回源层），dom/load=解析与子资源层，sw=是否 SW 拦截，tx=传输字节（0=缓存/SW 直出）
				const phases = nav
					? `;ttfb:${Math.round(nav.responseStart)};dom:${Math.round(nav.domContentLoadedEventStart)};load:${Math.round(nav.loadEventStart)}` +
					  `;sw:${navigator.serviceWorker && navigator.serviceWorker.controller ? 1 : 0};tx:${nav.transferSize || 0}`
					: '';
				const ver = runningHash();
				const ref = `nav:${nav ? Math.round(nav.duration) : -1}${phases}` + (worst ? `;${part(worst)}` : '') + (ver ? `;v:${ver}` : '');
				import('./api.js').then(({ trackEvent }) => trackEvent('slow_load', 'h5', ref));
			} catch (e) { /* RUM 失败不影响主流程 */ }
		};
		setTimeout(rumCheck, 5000);
		setTimeout(rumCheck, 65000);
		// 挂起型长尾（chunk 请求不发出/不完成 → 用户重载）没有完成的 resource entry，
		// 用前台心跳跨 reload 取证：重载启动时距上次心跳 >15s 视为一次挂起（启发式，仅作归因线索）
		try {
			const hb = Number(sessionStorage.getItem('kg_hb') || 0);
			const navE = performance.getEntriesByType('navigation')[0];
			if (hb && navE && navE.type === 'reload') {
				const gap = Date.now() - hb;
				if (gap > 15000 && gap < 300000) {
					import('./api.js').then(({ trackEvent }) => trackEvent('slow_load', 'h5', `hb-gap:${Math.round(gap / 1000)}s;reload`));
				}
			}
			setInterval(() => {
				if (document.visibilityState === 'visible') sessionStorage.setItem('kg_hb', String(Date.now()));
			}, 5000);
		} catch (e) { /* 取证失败不影响主流程 */ }
		// 陈旧壳自愈：SW 导航兜底（8s 超时回退缓存壳）会让慢链路用户持续跑旧 bundle；
		// 拉一次最新 HTML 比对主 chunk hash，不一致则 reload 一次（会话内防重入）
		const staleShellHeal = () => {
			try {
				if (document.visibilityState !== 'visible') return;
				if (sessionStorage.getItem('kg_sh_reload')) return;
				const cur = runningHash();
				if (!cur) return;
				fetch('/', { cache: 'no-store' })
					.then((r) => (r.ok ? r.text() : ''))
					.then((html) => {
						const m = html && html.match(/assets\/index-([\w-]+)\.js/);
						if (m && m[1] !== cur) {
							sessionStorage.setItem('kg_sh_reload', '1');
							location.reload();
						}
					})
					.catch(() => {});
			} catch (e) { /* 自愈失败保持原状 */ }
		};
		setTimeout(staleShellHeal, 15000);
		// SW 升级即校验：新 SW activate 后 postMessage，穿透缓存壳触达存量客户端
		try {
			if (navigator.serviceWorker) {
				navigator.serviceWorker.addEventListener('message', (e) => {
					if (e.data && e.data.type === 'kg-sw-updated') staleShellHeal();
				});
			}
		} catch (e) { /* 不支持则退回定时校验 */ }
	});
}
// #endif

// #ifdef H5
// 静态启动屏隐藏：首个组件挂载后等两帧加隐藏类，只隐藏不移除——
// 节点从 DOM 移除会使 trace 侧 LCP 候选失效回退到水合后内容，保留节点让 LCP 稳定归属启动屏首绘
let splashDismissed = false;
function dismissSplash() {
	if (splashDismissed || typeof document === 'undefined') return;
	splashDismissed = true;
	if (typeof window !== 'undefined' && typeof window.__kgSplashOk === 'function') window.__kgSplashOk();
	requestAnimationFrame(() => requestAnimationFrame(() => {
		const el = document.getElementById('kg-splash');
		if (el) el.classList.add('kg-splash-done');
	}));
}
// #endif

export function createApp() {
	const app = createSSRApp(App);
	// #ifdef H5
	installVueErrorHandler(app, mReport, (e) => console.error(e));
	app.mixin({
		mounted() {
			dismissSplash();
		},
	});
	// #endif
	return {
		app,
	};
}
