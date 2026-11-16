# R449 首页「补练往期 ›」41 px 热区底缘与 hero 按钮 top 重叠 2 px（R440 起既有）→ `.hero-ds` 下外边距 20→24rpx + (c) 补量 + 到期项

生产 `98dffdf` → `27e8729`（bundle `index-C9xXSO1z.js` → `index-BtSdXYlL.js`；后端不动、无 DB 写入）。

## 1. 起点

R448 testing agent 如实登记：短文案下 `.hero-ds-arc` 41 px 热区与「今日计划」按钮 top 有 2 px 重叠（`elementFromPoint(300,517/518)` = arc）。本轮先量再定。

## 2. 一手取证（生产 `98dffdf`，Playwright，`/home/ubuntu/r449/hitbox_probe.py`）

| 视口 | arc rect | `.hero-ds` | `.hero-acts` top | 按钮 | 底缘逐 px（arc 中心 x） | 重叠 |
|---|---|---|---|---|---|---|
| 375 | (280.4, 477.4, 64.6, 41) → bottom 518.4 | (34, 489.4, 307, 17) margin-bottom 10px | 516.4 | 继续目标 34–243 / **今日计划 253–341** | 513.9–517.9 arc；518.9+ `hero-btn` | **2 px**，落在「今日计划」x 280–341 |
| 1440 | (1217.9, 380.2, 64.6, 41) → 421.2 | (354.5, 392.2, 924, 17) | 419.2 | 按钮左对齐 354–583，arc 下方是 `.hero-acts` 空白 | 416.7–420.7 arc；421.7+ `hero-acts` | 2 px，但无按钮 → 无功能冲突 |

- 几何来源：热区底 = 行底 + 12 px（`padding:12px`、`top:50%` 居中，行高 17 → 上下各多出 12），`.hero-ds` margin-bottom 20rpx = 10 px → 差 2 px。
- 谱系：R440 用负外边距撑 41 px 热区时纵向范围即 477.4–518.4，当时 arc x 144.9/243.6 压的是「继续目标 ›」主按钮顶部 2 px；R447 右浮动 / R448 绝对定位只改 x，纵向不变 → **R440 起既有，非 R447/R448 回归**。
- 顶部：热区上缘 477.4 盖住 `.hero-bar`（475.4–481.4）底 4 px，进度条非交互 → 不计。
- 影响评估：命中条件 = 点在按钮顶 2 px 且 x 落在 280–341（「今日计划」右 2/3）。真人拇指点按钮中心为主，实际误触概率低；但两个可点目标共享像素、且按钮是主操作、链接是次级 → 有明确判据可修，代价 2 px。

## 3. 方案取舍（均在生产页注入样式实测）

- A（采纳）`.hero-ds` margin-bottom 20rpx → 24rpx（+2 px）：热区底 518.4 == acts top 518.4，扫描 ≤517.9 arc / 518.9+ 按钮，重叠 0；arc/ds rect 不变、41 px 热区不变、按钮 44 px 不变，hero 整体高 +2、下方内容 +2（静态排版、非 CLS）。
- B `.hero-acts{position:relative}`：靠绘制顺序（同为定位盒、DOM 靠后者在上）让按钮赢命中，几何 0 变化，但链接有效热区在按钮 x 段缩到 39 px、且规则意图对维护者不可见 → 否决。
- C arc padding 12→10：热区 37 px < R440 ≥40 px 契约 → 否决。
- 长文案两行态：arc 居中于 34 px 行，仅下伸 3.5 px，A 之后间隙 8.5 px，本就无重叠。

## 4. 改动（`27e8729`）

- `frontend-uni/src/pages/home/home.vue` 1 处：`.hero-ds { …; margin: -8rpx 0 24rpx; }`
- `tests/home-r447-hero-ds-arc-float.test.js` +1 用例：`.hero-ds` margin-bottom(rpx)/2 ≥ arc padding(px)（先在旧源上失败 10<12，再修）。
- 本地 vitest 624（+1）/ eslint / build:h5 绿。

## 5. 复验

- 本地 dist 经代理（`X-Kg-Probe:1`）：375/1440 acts top 518.4/421.2 == arc bottom，overlap 0。
- 部署 rc=0，rev/bundle 一致，gzip 125 KB；6b 12 项全 OK（`/` perf 0.98 / LCP 1403 / CLS 0.06；`/tiku/` 1.00 / 964）。
- 生产同脚本：与本地一致；R448 长文案注入脚本复跑：375 两行 arc (280.4, 485.9)、acts 535.4（+17）、无重叠；1440 单行。
- testing agent（`r449-ui-a`，375/1440，录屏 `/home/ubuntu/screencasts/r449-regress/r449-regress-edited.mp4`，报告 `/home/ubuntu/r449_test_report.md`）(a)–(e) 全 PASS：`elementFromPoint` 1 px 步长 515.4–521.4 ≤517.4 链接 / **518.4 起「今日计划」**；可信点击 (300,517) → 往期 sheet、(300,519)/(300,520) → 计划 sheet（R448 时 (300,518) 弹往期）；拦/正常 rAF 408–414 帧 arc/acts/taskcard Δ0；三按钮 top+1 px 各自正确响应；注入长文案 375 arc 底 526.9 < acts 535.4；`<12px []`、console 0、`/api` 126 条非 2xx 0、healthy 0 重启、日志 5xx/Traceback/locked 0、清理 LEFTOVER 0。
- testing agent 如实登记：设置期一次 reload 后仿真未重申（cw 360）导致一次 (300,519) 落到 arc 的假象，已作废重做（守卫 cw==375）；1440 桌面按钮左对齐、与链接 x 不相交，判据成立但形态与 375 不同。

## 6. (c) 自然旧壳 404 补量（R448 发版 18:30:33Z 后 27 min，caddy 源站）

228 请求：200 ×220、304 ×8（全为本机 Chrome `/sw.js`）；`/assets/*` 404 0、`/api/monitor/report` 0、`sheet-x` 0 → 仍无样本，继续挂；R449 发版后同样待下轮补量。

## 7. 到期项

沿用 R448 18:53Z 只读结果（本轮无 DB 写入、间隔 <1 h）：probe=0 22 行/1 uid、error_reason 6/0、push_subs 0、weekly_reports 0、growth_events probe=0 18/4、29/29 CST 00:00、WAL 1.6 MB；容器 healthy 0 重启（R449 部署后 started 19:02:48Z）。

## 8. 事实 / 推断 / 未验证

- 事实：§2 表、§5 全部为 Playwright/CDP 实测；2 px 重叠 R440 起既有可由 R440 CSS 推出且 R447 testing agent 测过同一纵向 rect。
- 推断：「真人误触概率低」——无真人点击热力数据（`growth_events` 无按钮级事件）。
- 未验证：真机触摸 Chrome 有 touch adjustment 可能本就把顶 2 px 归给更大目标，本轮只用 `Input.dispatchMouseEvent` 精确点击验证；无 emoji 字体机器注入 🔥 为 □。
