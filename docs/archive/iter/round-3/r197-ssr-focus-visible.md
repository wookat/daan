# R197：/tiku SSR 页族键盘焦点可见性对齐 SPA

## 取证（2026-09-01，生产一手证据）

1. **7d 窗口复核无新缺陷**：growth_events 分布与 R196 一致（boot 145 / slow_load 47，均为已知 nav:60/90s 无 UA 族群 + 个别可归因 ShapBot 爬虫长尾）；answer_log 152/23 uid 持平。
2. **SPA 侧已有对照标准**：`frontend-uni/src/a11y-focus.js` 注入全局
   `:focus:not(:focus-visible){outline:none}:focus-visible{outline:2px solid #2e5bff;outline-offset:2px}`——键盘 Tab 焦点有 2px 高对比焦点环（R123 起建立）。
3. **SSR /tiku 页族缺口 verified**：生产 `/tiku/` HTML 内联 CSS 全文只有一处焦点样式：
   `.hdr-s input{…outline:none}` + `.hdr-s input:focus{border-color:var(--link)}`——搜索框主动抑制原生 outline，仅剩 1px 边框变色（浅色下 #d1d5db→#2e5bff，可辨识性弱，不满足 WCAG 2.2 SC 2.4.11 Focus Appearance 的 ≥2px 周界建议）；页内链接/CTA 依赖浏览器默认 outline，风格与 SPA 不一致。axe/Lighthouse a11y=1.0 不覆盖此项（focus 样式为动态态，自动扫描盲区），属对照 SPA 既有约定 + WCAG 2.4.7/2.4.11 的真实缺口。

## 方案

`backend/app/seo.py` `_CSS` 对齐 SPA 约定：

- 新增 `:focus-visible{outline:2px solid var(--link);outline-offset:2px;border-radius:4px}`（token 化，深色自动跟随 --link）；
- 搜索框去 `outline:none` 抑制，改 `.hdr-s input:focus:not(:focus-visible){outline:none}` 保留鼠标点击无环的现状、键盘 Tab 有环；`:focus` 边框变色保留。

不做：skip link（页族头部仅品牌+搜索+1 CTA，无长导航块，收益存疑不立项）。

## 验证计划

- ruff/pytest 全绿（含既有 SSR 快照类测试）；
- 部署后生产 1440/375 键盘 Tab 走查 `/tiku/`、`/tiku/q/1`：链接/搜索框/CTA 均出 2px 焦点环，鼠标点击无环；light/dark 焦点环颜色跟随 --link；
- axe light/dark 复扫维持 0 违例；本次部署同时首次真实复验 R196 step 6b 性能预算路径。
