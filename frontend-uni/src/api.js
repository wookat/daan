// API 封装 barrel：实现已按域拆至 api/{client,social,daily,export,ai,play,net}.js。
// 调用侧 `import { x } from '../../api.js'` 不变。
export * from './api/client';
export * from './api/social';
export * from './api/daily';
export * from './api/export';
export * from './api/ai';
export * from './api/play';
