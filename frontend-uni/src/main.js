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
	});
}
// #endif

export function createApp() {
	const app = createSSRApp(App);
	return {
		app,
	};
}
