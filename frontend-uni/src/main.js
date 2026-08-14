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
		// 慢加载 RUM：偶发 ~40s 壳/chunk 长尾在服务端无痕（疑 SW/客户端侧），上报导航与最慢资源耗时取证
		setTimeout(() => {
			try {
				const nav = performance.getEntriesByType('navigation')[0];
				const worst = performance
					.getEntriesByType('resource')
					.filter((r) => r.duration > 8000)
					.sort((a, b) => b.duration - a.duration)[0];
				if ((!nav || nav.duration < 10000) && !worst) return;
				const part = (e) => `${(e.name || 'nav').split('/').pop().split('?')[0].slice(0, 48)}:${Math.round(e.duration)}`;
				const ref = `nav:${nav ? Math.round(nav.duration) : -1}` + (worst ? `;${part(worst)}` : '');
				import('./api.js').then(({ trackEvent }) => trackEvent('slow_load', 'h5', ref));
			} catch (e) { /* RUM 失败不影响主流程 */ }
		}, 5000);
	});
}
// #endif

export function createApp() {
	const app = createSSRApp(App);
	return {
		app,
	};
}
