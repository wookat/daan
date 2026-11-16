# R325 设计：字号设置扩展到做卷页与错题本复习流

日期：2026-08-29 ｜ 轮次：round-3 R325 ｜ 状态：方案 → 实现

## 取证（先调查）

- `pages/practice/practice.vue`：字号三档（小/标准/大）已实现——`fontLv` 存 storage，`qStyle`（题干 26/30/34rpx）与 `optStyle`（选项 25/29/33rpx）computed 绑定到题干与选项；工具面板可切换。
- `pages/profile/profile.vue:91`：「字号与显示」cell 循环切换 fontLv，toast 明确写「（练习页生效）」——设置本身承认只覆盖一个页面。
- `pkgA/exam/exam.vue`：题干 `.q` 与选项 `.otext` 固定字号，`grep fontLv` 0 命中。做卷是长时阅读最重的场景（2 小时 120 题），却不吃字号设置。
- `pages/book/book.vue`：复习流题干 `.q`、解析 rich-text 固定字号，0 命中。错题复习同为高频阅读场景。
- 对标：粉笔做题设置的字号调节对刷题/做卷/解析全局生效；本站三大做题场景两个不生效，设置页承诺与实际能力不一致。

## 方案（纯前端零后端/零契约）

1. `pkgA/exam/exam.vue`：data 读 `fontLv`（storage，默认 1），computed `qStyle`/`optStyle` 与 practice 同表（26/30/34、25/29/33rpx），绑定题干 `.q`（含材料折叠态 stem）与选项 `.otext`；onShow 重读 storage（从 profile 改完返回即生效）。
2. `pages/book/book.vue`：复习流同构——题干 `.q` 绑 qStyle、解析 rich-text 外层容器绑 optStyle（rich-text 内 HTML 字号继承容器）。仅复习模式绑定，列表卡不动（列表是扫描态非精读态，粉笔同口径）。
3. `pages/profile/profile.vue`：toast 文案「练习页生效」→「做题与复习页生效」。
4. 不新增设置项/URL 状态/后端；fontLv 非法值 fail-closed 按 1（既有 `|| 1` 语义保留，显式 [0,1,2] 越界钳制）。

## 验证计划

- vitest：新纯函数 font-size.js（fontSizes(lv) 返回 {q,opt}，非法钳 1）+ 三档用例。
- 本地：lint / vitest / build:h5。
- 生产：testing agent 实测——profile 切「大」→ 做卷页题干/选项变大、材料折叠态生效；错题本复习流题干/解析变大；切回「标准」恢复；练习页回归不变；375/1440 溢出 0、console 0 error。
- 清理临时 uid、保护 uid 快照对比。
