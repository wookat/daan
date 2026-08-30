# R47 设计方案：首页渲染阻塞 CSS 内联（render-blocking 450ms 收敛）

## 一手证据（2026-08-29 生产取证）

Lighthouse mobile（https://kaogong.zalize.com/，R46 部署后）：performance 0.87，FCP 2.5s / LCP 3.3s / TBT 140ms。
`render-blocking-insight`（score 0，Est savings 450ms）三个阻塞资源均为小 CSS：

| 资源 | 字节 | wastedMs |
|---|---|---|
| /static/brand/zalize-tokens.css | 2,308 | 471 |
| /assets/uni.8f3b9d07.css | 5,198 | 171 |
| /assets/index-*.css | 4,966 | 471 |

合计 ~12.5KB，阻塞主因不是体积而是移动网络下的额外请求往返（HTML 解析→发现 link→请求→等待）。

## 方案（架构决策）

**构建后内联**：新增 `frontend-uni/scripts/inline-critical-css.mjs`，在 `build:h5` 末尾执行——解析 `dist/build/h5/index.html` 中 `<link rel="stylesheet">`（三个：uni.*.css、index-*.css、zalize-tokens.css），读取对应文件内容替换为 `<style>`。

- 不改 uni 构建管线/vite 配置（hashed 文件名从产物 HTML 自身解析，天然跟随 hash 变化）；
- 三文件合计 ~12.5KB（gzip 后更小），内联进 HTML 不产生显著文档膨胀，符合 critical CSS 惯例（<14KB）；
- CSS 资产文件保留在 dist（分包页面无引用，仅 index.html 消费，保留无副作用、便于回滚）；
- CSP 已允许 `style-src 'unsafe-inline'`，内联样式不违反现行策略；
- 仅 H5 产物后处理，小程序构建零影响。

## 验收标准

- 构建后 index.html 无 `<link rel="stylesheet">`、含三段 `<style>`；
- 生产复验 Lighthouse：render-blocking-insight 通过或 savings 显著下降，FCP/LCP 改善，performance ≥0.90；
- 1440/375 视觉零变化、console 0 error；
- 部署回归（bundle hash/encoding/接口）全绿。

## 风险

- 内联后 CSS 不再独立缓存——三文件合计 12.5KB 且 HTML 本身不缓存（SPA 入口），损失可忽略；
- 若某 link 文件缺失，脚本 fail-fast 报错终止构建（不产出半内联产物）。
