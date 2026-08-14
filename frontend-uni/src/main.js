import {
	createSSRApp
} from "vue";
import App from "./App.vue";

// #ifdef H5
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
				const ref = `nav:${nav ? Math.round(nav.duration) : -1}` + (worst ? `;${part(worst)}` : '');
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
