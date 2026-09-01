// 独立于 vite.config（uni 插件依赖 uni-app 运行时上下文，纯逻辑单测不加载）
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
});
