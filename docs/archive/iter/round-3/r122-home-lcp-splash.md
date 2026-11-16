# R122：首页 LCP 提前到静态启动屏

## 取证（verified facts，2026-08-31 生产 Lighthouse 12，移动模拟）

- /tiku、/tiku/q/3、/tiku/daily/：perf 0.9–1.0、a11y/BP/SEO 全 1.0，无可立项缺陷。
- 首页 perf 0.91：FCP 0.8s、SI 1.4s、TBT 120ms，但 LCP 3.2s。
- LCP 元素为 Vue 挂载后才渲染的 hero 文案 `uni-text.ld-s`
  （「拍题 AI 讲解 · 错题本按遗忘曲线复习 · 迷你模考 —— 免注册，打开即练」，342×42），
  即 LCP 被主 chunk 下载+执行+渲染整链路拖到 3.2s；
  R101 静态启动屏文本（13px 单行）面积小于 hero 文案，未被判为 LCP。

## 方案（仅 index.html 静态启动屏，零运行时改动）

启动屏副标题替换为与 hero 一致的价值主张长文案并加大字号（16px、两行、限宽），
使首绘制（0.8s）即包含页面最大文本块，LCP 判定落在启动屏而非 Vue 挂载后：

- `.s` → 16px/1.5、max-width 340px、text-align:center，文案与 hero `.ld-s` 一致；
- 深色模式/布局/自愈逻辑不变；挂载后整树替换语义不变。

## 验证

- 本地 build:h5（inline-critical-css 照常）；
- 生产 Lighthouse 首页复测：LCP 元素变为启动屏文本、LCP 显著下降、perf 提升；
- 1440/375 双视口回归：加载期启动屏视觉正常、挂载后首页正常、console 0 error。
