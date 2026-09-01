// 仓库根 flat config：唯一作用是把 base path 提到仓库根，
// 使 frontend-uni 之外的 JS（deploy/cf-pages 边缘函数）可被同一套规则纳管。
// 实际规则/globals 维护在 frontend-uni/eslint.config.mjs（插件依赖装在该目录）。
import cfg from './frontend-uni/eslint.config.mjs';

export default cfg;
