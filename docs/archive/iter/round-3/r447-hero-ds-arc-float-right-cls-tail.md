# R447 首页「补练往期 ›」右浮动——R445 剩余 CLS 尾项 0.0024 归零（375/1440 一手对照 → 最小 CSS 修 → 生产复验）

生产 `3dc59fa` → `c7347a1`（bundle `index-DaOBPuSg.js` → `index-CYevCgSz.js`；后端不动、无 DB 写入）。

## 1. 起点

R445 把 `.hero-ds` 行常驻后，Playwright layout-shift sources 只剩 #2 0.0024：`/api/daily_set` 回包在同一行追加「· 已有 N 人完成 / 来做今天第 1 人」，行内文字链「补练往期 ›」被推着水平右移。R445 登记 P4：改右对齐属视觉排版改动，先看 375/1440 视觉对照再定。

## 2. 一手取证（生产 `3dc59fa`，Playwright 直连 Chrome，`/home/ubuntu/r447/heroref_probe.py`）

| 视口 | 态 | `.hero-ds` rect | `.hero-ds-arc` rect | `.hero-acts` y | taskcard y |
|---|---|---|---|---|---|
| 375 | 拦 `/api/daily_set`（清 `apiSnap`） | (34, 489.4, 307, 17) | (**144.9**, 477.4, 64.6, 41) | 516.4 | 583.4 |
| 375 | 正常回包「· 来做今天第 1 人」 | (34, 489.4, 307, 17) | (**243.6**, 477.4, 64.6, 41) | 516.4 | 583.4 |
| 1440 | 拦 | (354.5, 392.2, 924, 17) | (**465.4**, 380.2, 64.6, 41) | 419.2 | 486.2 |
| 1440 | 正常 | (354.5, 392.2, 924, 17) | (**564.1**, 380.2, 64.6, 41) | 419.2 | 486.2 |

- 事实：纵向几何全部不变（R445 已修），只剩链接 x 漂 98.7 px；375 下链接落在行中间、1440 下落在 924 px 宽行的左 1/4 处，后面留大段空白——右对齐本来就更合布局。
- 本地在页面注入 `.hero-ds-arc{float:right;margin-right:0!important}` 对照：375 x=276.4、1440 x=1213.9，两态 x 相同，单行、纵向几何不变。截图 `/home/ubuntu/r447/hero-{375,1440}-{no-daily_set,normal,normal-mock-right}.png`。

## 3. 设计取舍

- 备选 A：`.hero-ds` 改 flex + `justify-content:space-between`。改动面大（uni `<text>` 内嵌 `<text>`，H5 编译为 span 嵌套，父级 flex 会让内文本节点成匿名 flex item，换行行为要重验）。
- 备选 B（采纳）：只改 `.hero-ds-arc` 一条：`display:inline-block` → `float:right`，其余（-12px 纵向负外边距 + 12px 内边距撑 41 px 热区、8rpx 横向内边距、下划线、颜色）不动，再加 `margin-right:-8rpx` 让链接**文字**右缘与 hero 内容右缘对齐（热区外扩 4 px）。浮动盒是块级盒，纵向 padding 仍生效，R440 热区契约保留。
- 已完成分支（`dsMeta && dsDone`，「已完成 答对 x/10 · 第 N 名 · 🔥 连 N 天」）文案更长，右浮动时左侧文字宽度超过可用宽会绕浮动折到第二行（不重叠）——375 下需实测边界，见 §5。

## 4. 改动

- `frontend-uni/src/pages/home/home.vue` 样式块 1 行：`.hero-ds-arc { float: right; margin: -12px -8rpx -12px 8rpx; padding: 12px 8rpx; text-decoration: underline; color: rgba(255, 255, 255, 0.75); }`
- 新单测 `frontend-uni/tests/home-r447-hero-ds-arc-float.test.js`（源锁 float / 无 inline-block / 负外边距与内边距不变）。
- R440 源锁 `home-r440-fontfloor.test.js` 原断言「热区须 `display:inline-block`」→ 放宽为「`inline-block` 或 `float:right`」（两者都是块级盒、纵向 padding 生效，锁的是热区 ≥40 px 这一意图），`margin` 断言接受 `-12px (0|-8rpx) -12px`。这是本轮有意改动的契约，不是为过测试改测试。
- 本地：vitest 622（+1）/ eslint 0 / `build:h5` 绿。

## 5. 生产复验（`c7347a1`）

- 部署 `deploy_h5.sh` rc=0；线上 bundle 与本机一致；5b 编码变体校验过；6b 12 项全 OK（`/` perf 0.99 / LCP 931 / **CLS 0.06**；`/tiku/` 1.00 / 995 / 0.00）。
- 本机 `heroref_probe.py` 复跑：375 拦/正常 arc 均 (280.4, 477.4, 64.6, 41)；1440 均 (1217.9, 380.2, 64.6, 41)；`.hero-ds` h17 单行、`.hero-acts`/taskcard y 与改前逐位相同。`arc.right − 4 == hero 内容右缘`（375: 345−4=341=34+307；1440: 1282.5−4=1278.5=354.5+924）。
- Playwright layout-shift sources ×9（`r444/cls_sources.py` 3 次 × 3）：**只剩 #1 0.0608**（uni TabBar 占位、启动屏下），#2 消失。
- testing agent（375×812 / 1440×900，探针头 + 新 uid `r447-ui-a`，(a)–(e) 全 PASS 无 FAIL）：
  - 正常态两视口链接固定靠 hero 内容右缘（`arc.right-4 == .hero-bar.right`：341 / 1286），64.6×41 热区，12px / 下划线 / 颜色不变；左侧文字止于 239.6 / 567.6，无重叠、单行。
  - 拦截 `/api/daily_set`（清快照）rAF 逐帧 408/412 帧：arc rect 恒定；`.hero-acts`、今日任务卡 y 与正常态 Δ0；正常加载 t=165 ms 占位帧 → t=191 ms 回包追加文案，arc x **不动**。
  - 点链接弹 7 天 actionSheet（1440 popover 点遮罩关，既有行为）；点左侧文字不误触。
  - **已完成分支实测**：原生做完当天 10 题（答对 1/10、submit 200、第 1 名）回首页 →「今日全站同题 · 已完成 答对 1/10 · 第 1 名 补练往期 ›」375/1440 均单行、右对齐、无重叠，375 余量 21.6 px。
  - `<12px []`、console/pageerror/rejection 0、`/api` 133 条真实非 2xx 0；容器 healthy 0 重启、5xx·Traceback·locked 0；清理 5 表 24 行 → LEFTOVER 0。
  - 1440 arc x 实测 1225.4 vs 本机 1217.9：testing agent 侧 `clientWidth=1440`（无占位滚动条）、本机 1425（15 px 滚动条），差 7.5 px = 滚动条一半；对齐不变量两边都成立 → 以后比对用不变量不用绝对 x。
- 截图 `/home/ubuntu/r447_artifacts/`，录屏 `/home/ubuntu/screencasts/r447-regress/r447-regress-edited.mp4`，报告 `/home/ubuntu/r447_test_report.md`。

## 6. 到期项只读复查（容器内 `r446_due.py`，09-06 18:01Z）

- `answer_log` probe=0 仍 22 行 / 1 uid，最新 09-06 08:57（vivo 小程序）；probe=NULL 后 R374 新增 0。
- `mistakes.error_reason` 非空 6 行，与 probe=0 关联 0。
- `push_subs` 0、`weekly_reports` 0。
- `growth_events` probe=0 18 行 / 4 uid 与 R446 相同、无新增；`stale_fallback` 20 行全 probe=1。
- WAL 564 KB（64 MiB 阈值未触发）；容器 healthy 0 重启。
- (c) `.sheet-x`/自然旧壳 404：本次发版后待补量（下轮）。

## 7. 事实 / 推断 / 未验证

- 事实：改前后 rect 逐位数据、CLS sources 9 次、6b、testing agent 逐帧与已完成态实测。
- 推断：「375 已完成态若同时带 `· 🔥 连 N 天`（+57.9 px）总宽 ≈305.7 > 可用 246.4 px → 绕浮动折到第二行（不重叠、行高变）」是同字体离屏量宽推算，`streak≥2` 无真实数据未触发。折行只在「已完成 + 排名 + 连续 ≥2 天」同时成立时出现；折行后 `.hero-ds` 高度变化发生在回包之后（与 R445 前 #2 同性质但仅限该态），是否接受或缩文案请老板定。
- 未验证：真机（非 Chrome DevTools 模拟 375）字体度量；小程序端不受影响（独立代码）。
