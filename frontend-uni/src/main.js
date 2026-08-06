import {
	createSSRApp
} from "vue";
import App from "./App.vue";

// #ifdef H5
// 离线壳：缓存静态资源，断网时仍能进入应用（离线做题依赖已下载题包）
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && location.protocol !== 'file:') {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/sw.js').catch(() => {});
	});
}
// #endif

export function createApp() {
	const app = createSSRApp(App);
	return {
		app,
	};
}
