// 复用 frontend-uni 的 vitest：cd miniapp-native && ../frontend-uni/node_modules/.bin/vitest run --config scripts/vitest.config.mts
export default {
  test: { include: ['scripts/**/*.test.ts'], environment: 'node' },
};
