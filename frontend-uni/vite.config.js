import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
// https://vitejs.dev/config/
// 线上 H5 部署在 kaogong.zalize.com/app/ 子路径（根路径留给落地页）；
// Capacitor/独立域名构建可用 KG_H5_BASE=/ 覆盖回根路径。
export default defineConfig({
  base: process.env.KG_H5_BASE || '/app/',
  plugins: [
    uni(),
  ],
})
