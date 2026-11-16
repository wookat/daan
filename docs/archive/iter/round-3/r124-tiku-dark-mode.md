# R124：/tiku SSR 页族深色模式适配

## 取证（verified facts，2026-08-31 生产实测）

- `curl /tiku/` 与 `/tiku/q/3`：HTML 内 `prefers-color-scheme` 出现次数 = 0——
  整个 SSR 页族（首页/模块/考点/年份/试卷/题目/每日一练/讨论/404）只有亮色一套；
- 对照：SPA 全站已支持深色（theme.js），R101/R122 静态启动屏也带
  `@media(prefers-color-scheme:dark)` 深色适配；
- 后果：深色环境用户从搜索/分享进入 SEO 页是刺眼纯白页，点「去刷题」进 SPA
  又切回深色，品牌体验割裂；夸克等现代公开页面均跟随系统配色。

## 方案（仅 backend/app/seo.py 的共享 _CSS/_page，零结构改动）

1. `_CSS` 颜色抽为 `:root` CSS 变量（bg/surface/border/text/muted/tag-bg/ans-bg/
   link），规则体引用变量，亮色取值与现值逐一相同（亮色渲染零变化）；
2. 追加 `@media(prefers-color-scheme:dark)` 变量覆盖：
   bg #111827 / surface #1f2937 / border #374151 / text #f3f4f6 / muted #9ca3af /
   link #7c9aff（brand 在深底对比不足，与启动屏深色 token 同族）/
   tag-bg #26324d / ans-bg #123527，阴影加深；CTA/hdr-cta 保持品牌底白字；
3. `<meta name="color-scheme" content="light dark">` 让 UA 表单/滚动条跟随。

对比度自查（WCAG AA ≥4.5:1）：#f3f4f6 on #1f2937 ≈ 12.6:1；#9ca3af on #1f2937 ≈
4.6:1；#7c9aff on #1f2937 ≈ 5.0:1；#fff on #2e5bff ≈ 4.7:1（现状既有）。

## 验证

- 本地 ruff + pytest（既有套件不校验颜色，应全绿）；
- 生产：/tiku/、/tiku/q/3、404 页在 dark/light 模拟下截图对比；
  axe 深色模式下复扫 0 violations；亮色像素级不回归（变量取值同现值）；
  1440/375 双视口 overflow 0。
