import {
	createSSRApp
} from "vue";
import App from "./App.vue";

// #ifdef H5
import "./pwa.js"; // 尽早注册 beforeinstallprompt 监听，供「我的」页安装入口使用
// 集中式错误监控（审计 P1-7）：未捕获 JS 错误同源上报 /api/monitor/report，由后端转发中心收集器
if (typeof window !== 'undefined') {
	const mSeen = new Set();
	let mSent = 0;
	const mReport = (message, stack) => {
		const key = String(message || '').slice(0, 200);
		if (mSeen.has(key) || mSent >= 10) return;
		mSeen.add(key);
		mSent += 1;
		const body = JSON.stringify({ message, stack, url: location.href });
		try {
			if (navigator.sendBeacon) {
				navigator.sendBeacon('/api/monitor/report', new Blob([body], { type: 'application/json' }));
			} else {
				fetch('/api/monitor/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
			}
		} catch (e) { /* 监控绝不影响主链路 */ }
	};
	window.addEventListener('error', (e) => {
		mReport(e.message || 'window.onerror', e.error && e.error.stack);
	});
	window.addEventListener('unhandledrejection', (e) => {
		const r = e.reason;
		if (r && r.stack) mReport(`unhandledrejection: ${r.message || r}`, r.stack);
		else mReport(`unhandledrejection: ${String(r).slice(0, 500)}`);
	});
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
				const ref = `nav:${nav ? Math.round(nav.duration) : -1}${phases}` + (worst ? `;${part(worst)}` : '');
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
	});
}
// #endif

export function createApp() {
	const app = createSSRApp(App);
	return {
		app,
	};
}
