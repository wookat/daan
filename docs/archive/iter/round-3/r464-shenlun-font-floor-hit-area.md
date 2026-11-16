# R464 · 申论页（`pkgA/shenlun/shenlun.vue`）首次过 R410+ 字号下限 / 40px 热区审计——修复 + 部署 + 375/1440 生产复验

R463 §4 命中：申论真题库/素材/作答记录页自 R242 建页起未过 R410+ 审计。本轮只改 **1 个前端文件 + 1 个源锁**，后端不动、无 DB 写入。
生产 `fe57df3` → `04ef7f7`（同一分支 PR #619，base=main，仍 open）。

## 1. 结论先行

1. **字号**：样式块 15 处 `20–23rpx`（375 下 10–11.5px）全部提到 `24rpx`（=12px 下限，与 R411 stats / R412 social-bar 同口径）：
   `.q-meta .chip .hist-time .hist-res .q-paper .q-type .d-nav-pos .d-notes .d-copy .chip.sm .sheet-k .m-src .m-hit .d-save .g-note`。
   `.chip.sm` 不再单独写字号（继承 `.chip` 24rpx）。
2. **热区**：10 类可点元素补 `min-height: 40px`（页面层口径，与 book/social-bar 同法）：`.seg-i`（页签）、`.chip`（筛选/素材类型/抽屉 `.chip.sm`）、
   `.q-go`（去作答）、`.sheet-x`（本页自写筛选 ✕，40×40 + 负外边距不抬标题行）、`.back`（返回列表）、`.d-nav-btn`（上/下一题）、
   `.d-h.toggle`（给定资料/参考要点折叠标题）、`.d-copy`（复制链接）、`.retry`、`.grade-btn`（原 padding 20rpx ≈ 36px）。
3. **`.q-paper.tappable`（「只看本套卷」）是本仓库页面层第一次用 `::after` 撑命中区**：它是 `.q-tags` 行里带底色的 20px 小标签，直接
   `min-height: 40px` 会把标签本体撑成 40px 大药丸、与并排的 `.q-type` 不一致；改为 `position: relative` + `::after { position:absolute; top:50%;
   height:40px; translateY(-50%) }`，视觉仍 19.8/21px。命中区用 `document.elementFromPoint` 一手验证：标签中心 ±19px 命中 `.q-paper.tappable`，
   ±21px 不命中 → 恰好 40px 带（375/1440 两视口、本地 dist 与生产各一次）。父级 `.q-item .card` 无 `overflow: hidden`，未被裁。
4. **不动的**：`.more` 45.8、`.m-star` 42.2、`.sf-btn` 42.2/44 原已达标；`.q-type`/`.q-paper`（非 tappable）/`.m-hit` 是纯信息标签，只改字号不撑高。
5. 到期项无增量（§4）；(c) 部署窗口 origin 184 请求 `/assets/*` 404 0 / monitor 0；perf 预算一次 0.88 WARN → 独立复跑 0.93 全 OK（R460 同形态）。

## 2. 改动清单（`frontend-uni/src/pkgA/shenlun/shenlun.vue`，仅 `<style>`）

| 选择器 | 改前 | 改后 |
|---|---|---|
| `.seg-i` | `padding: 12rpx 28rpx`，24rpx | `min-height: 40px; box-sizing: border-box; padding: 0 28rpx` |
| `.chip` | `padding: 12rpx 24rpx`，23rpx | `min-height: 40px; box-sizing: border-box; padding: 0 24rpx`，24rpx |
| `.chip.sm` | 22rpx，`padding: 10rpx 20rpx` | `padding: 0 20rpx`（字号/高度继承 `.chip`） |
| `.q-go` | `padding: 12rpx 0 12rpx 24rpx` | `inline-flex; min-height: 40px; padding: 0 0 0 24rpx; margin: -6px 0`（卡片 foot 行高不变） |
| `.q-paper.tappable` | 仅 `cursor/underline` | `+ position: relative` + `::after` 40px 带 |
| `.sheet-x` | `padding: 10rpx 0 10rpx 24rpx` | `flex; 40×40; margin: -6px -10rpx -6px 0` |
| `.back` | `padding: 6rpx 0 18rpx` | `flex; min-height: 40px; padding: 0 0 8rpx` |
| `.d-nav-btn` | `padding: 10rpx 18rpx` | `inline-flex; min-height: 40px; padding: 0 18rpx` |
| `.d-h.toggle` | 继承 `.d-h margin: 22rpx 0 10rpx` | `flex; min-height: 40px; margin: 6rpx 0 0` |
| `.d-copy` | 22rpx，`padding: 4rpx 6rpx` | 24rpx，`inline-flex; min-height: 40px; padding: 0 6rpx; margin: -10px 0` |
| `.m-foot` | `align-items: baseline` | `align-items: center`（容纳 40px 的 `.d-copy`） |
| `.retry` / `.grade-btn` | 无 min-height | `min-height: 40px`（grade-btn `box-sizing: border-box`） |
| 15 处字号 | 20–23rpx | 24rpx |

源锁：`frontend-uni/tests/shenlun-r464-audit.test.js`（样式块无 <24rpx；10 类选择器含 `min-height: 40px`；`.q-paper.tappable::after` 40px/top 50%/translateY；`.sheet-x` 40×40 + 负外边距）。

## 3. 一手量测（Playwright CDP，`X-Kg-Probe: 1`，同一 CDP 连接内两个 context 取 375 与 1440）

375 仿真 `clientWidth` 报 360（R460/R463 同法，24rpx 计算 11.52px；1440 为 12px）。本地 dist（`/api` 转发生产只 GET）与部署后生产**数值逐项一致**。

| 元素 | R463 生产改前 | R464 生产 375 | R464 生产 1440 |
|---|---:|---:|---:|
| `.seg-i` | 29.5 | **40** | **40** |
| `.chip` | 29.5 | **40** | **40** |
| `.chip.sm`（抽屉） | 26.6 | **40** | **40** |
| `.q-go` | 27.5 | **40** | **40** |
| `.sheet-x` | 29.6 | **40×40** | **40×40** |
| `.q-paper.tappable` 视觉 / 命中带 | 18.8 / 18.8 | 19.8 / **40**（±19 命中、±21 不命中） | 21 / **40** |
| `.back` | ≈25（源码判） | 43.8 | 44 |
| `.d-nav-btn` | ≈23（源码判） | **40** | **40** |
| `.d-h.toggle` | ≈17（源码判） | **40** | **40** |
| `.d-copy`（详情 / 素材 foot） | ≈15（源码判） | **40** / **40** | **40** |
| `.grade-btn` | ≈36（源码判） | **40** | **40** |
| `.more` / `.m-star` / `.sf-btn` | 45.8 / 42.2 / 42.2 | 45.8 / 42.2 / 42.2 | 49 / 44 / 44 |

字号：改后全页 `<11.5px` 叶节点只剩 uni 原生 `uni-tabbar__label` 10px ×5（框架 TabBar，历轮既定不动）；改前 R463 为 11.0–11.5px ×65 节点。
布局：列表卡片高 125.2（375）/131.6（1440），`.q-top` 20/21、`.sheet-h` 28 均未被撑高（负外边距生效）；素材 `.m-foot` 92px 由多行出处文本决定、非 `.d-copy`。

截图：`/home/ubuntu/r464_prod_375.png`、`r464_prod_sheet_375.png`、`r464_prod_detail_375.png`、`r464_prod_mat_375.png`（PR #619 评论附）。

## 4. 部署与到期项（23:13–23:17Z）

- 本地门：vitest **638/638**（85 文件，+4 源锁）、eslint 0、`build:h5` OK。后端未改、不重跑。
- `deploy_h5.sh --skip-build`：谱系闸 OK（`fe57df3` 是 HEAD 祖先）、宿主 `mem_avail=327MB disk_avail=3.5G(93%)`、compose rc=0、旧容器 23:13:48Z 停 → 新容器 23:15:12Z 起、
  rev `04ef7f7` 校验一致、Pages 上传 46 文件、bundle `index-D5BZVXo9.js` 一次传播重试后一致、7 种 Accept-Encoding 全 JS、6/6 回归全 200。
- perf 预算：随部署 `/` performance 0.88 WARN（LCP 1681 / CLS 0.06）→ 独立复跑 0.93 / LCP 2738 / CLS 0.06 全 OK，`/tiku/` 1.00。
- 到期项（严格 `probe=0`）：`answer_log` 33/1（last 21:39:44）、growth 20/4、`error_reason` 7（≥09-11 **0**）、push_subs 0、weekly_reports 2、`quick_check ok`、
  WAL 4,124,152 B 同字节、healthy `restarts=0`；origin 22:40Z 起 184 请求 `/assets/*` 404 0 / monitor 0 / miniprogram-UA 0 / 非 2xx = `304 /sw.js` ×2 + 自打 origin `403 /api/health` ×1。
- 宿主盘 **93% / 3.8 G**（部署时 3.5 G）。

## 5. 如实说明 / 未验证

- 375 数值为 360 仿真直读（未 ×1.042 折算），真机未量；11.52px 为仿真差异不是字号未达标（1440 同节点 12px）。
- `::after` 命中带是 `elementFromPoint` 在 `.q-tags` 行中心列的验证，未扫全宽；与 `.m-star`（右侧 42px）无水平重叠（flex gap 12rpx），
  40px 带只在标签上下各 ~10px 覆盖卡片 `openQ` 区域（点到即触发 `applyPaper`，行为可预期）。
- 作答记录 tab（`.hist-*`）、素材详情 `.m-content` 展开、`.d-nav` 翻题只按源码 + 详情页 DOM 量测，未走真实作答/批改流；`.g-note`/`.d-save` 为纯文本只改字号。
- 本轮无 testing agent 录屏（未另行授权），量测为 Playwright CDP 只读脚本；量测 uid 只发带探针头的 GET，未写库。
- PR #619 仍待人工合并（平台不允许 Devin 合入 main）；本轮与 R400–R463 同分支叠加。
