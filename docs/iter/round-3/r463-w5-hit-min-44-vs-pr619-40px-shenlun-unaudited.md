# R463 · W5 `--hit-min: 44px` 与 #619 既定 40px 下限口径对照 + 申论页（`pkgA/shenlun`）从未过 R410+ 字号/热区审计

只读取证，不改码、不部署，生产仍 `fe57df3`。目的：为 W5（#630）与 #619 的人工合并备一手「命中区口径」结论，
并复查到期项。

## 1. 结论先行

1. **两套口径可以分层共存、不是冲突**：W5 的 `--hit-min: 44px` 是**设计系统组件层**规则（KgButton / KgChipRow / KgSheet ✕ 等在
   组件内部用 `::after` 或 padding 把命中区撑到 44，视觉高度 32/36/28/20 不变）；#619 的 40px 是**页面层**规则（R410–R450 对每个
   可点文本/chip 直接写 `min-height: 40px` 并加源锁）。44 ≥ 40，凡 W5 组件真把命中区撑到 44 的地方，合并时取 W5 写法**不构成回退**，
   只需改源锁正则接受 `var(--hit-min)` / `::after` 形态。
2. **但 W5 有 5 处可点元素既没到自己的 44、也没到 #619 的 40**（W5 侧回退，已登记 #630，合并时按 #619 侧保留或换 KgButton/KgChipRow）：
   `book.vue` `.kpchip`（`kg-tag` 32px，#619 为 40）、`book.vue` `.cf` ×6 / `.pbadge`（`kg-tag` 视觉 20px、仅 `cursor: pointer`）、
   `q-social-bar.vue` `.qsb-link`/`.nop`（W5 去掉了 R412 的 `min-height: 40px`）、`home.vue` `.hero-lnk`（padding 8px×2 + 行高 ≈ 34px）、
   `shenlun.vue` `.paper-tag`/`.tappable`（`kg-tag` 20px）。`KgTag` 组件本体没有 `::after` 撑高逻辑（全仓 `grep` 仅 KgButton sm/md、KgChip 有）。
3. **顺带命中我方分支（#619）一处未审簇**：`pkgA/shenlun/shenlun.vue`（申论真题库 / 素材 / 作答记录）**从未过 R410+ 的 12px 字号下限与
   40px 热区审计**——源码 15 处 `20–23rpx`（375 下 10–11.5px）、可点元素 seg-i / chip / chip.sm / q-paper / q-go / sheet-x / d-copy 生产
   375 实测高 19–31px（表见 §4）。这是 R430/R440/R450/R460 四次 SOP-10 选簇都没选到的页面 → **R464 立项修复**（前端 1 文件 + 源锁 + 部署 + 复验）。
4. 到期项无增量：`answer_log` probe=0 33/1、growth probe=0 20/4、`error_reason` 7（≥09-11 **0**）、push_subs 0、weekly_reports 2、
   `quick_check ok`、WAL 4,124,152 B 同字节、healthy `RestartCount 0`；(c) 22:40–22:58Z 99 请求 `/assets/*` 404 0 / monitor 0 / 非 2xx 仅自打 origin 403。

## 2. W5 设计系统命中区规则（一手：`origin/devin/w5-integration`）

`tools/design-tokens/tokens.json` → `frontend-uni/src/styles/tokens.generated.css`：

```
--btn-h-lg: 44px  --btn-h-md: 36px  --btn-h-sm: 32px
--chip-h: 32px    --tag-h: 20px     --hit-min: 44px
```

| 组件 | 视觉高度 | 命中区实现 | 结果 |
|---|---|---|---|
| `kg-button.vue` sm/md | 32 / 36 | `.kg-btn--sm::after, .kg-btn--md::after { position:absolute; top:50%; height:var(--hit-min); transform:translateY(-50%) }` + `overflow: visible !important` | 44 ✅ |
| `kg-button.vue` lg | 44 | 本体 | 44 ✅ |
| `kg-chip-row.vue` md | 32 | 行 padding `calc((var(--hit-min) - var(--chip-h))/2)` + `.kg-chip::after` 44 | 44 ✅ |
| `kg-chip-row.vue` sm | 28 | 同上（`--kg-chips-pad: calc((44px - 28px)/2)`） | 44 ✅ |
| `kg-sheet.vue` 关闭 ✕ | — | `.kg-sheet__x { width/height: var(--hit-min) }` | 44 ✅ |
| `kg-tag.vue` | 20 | **无** `::after`、无 min-height；组件文档把 tag 定位为「信息标签」 | 20 ❌（一旦被当按钮用） |

W5 文档 `docs/design-system/SPEC.md:238`「触控目标 ≥ 44×44px（按钮 sm 32px 高时用 padding 或 `::after` 扩展命中区到 44）」、`COMPONENTS.md:68/280`。
即 W5 自己宣称的下限比 #619 的 40 更严——问题只在**落实**：`var(--hit-min)` 在 27 个 H5 文件里有用（✕ / 星标 / 输入框 / 行高 / `.d-toggle` 等），
但凡用 `kg-tag` 当按钮、或裸 `<text>` 链接的地方都漏了。

## 3. W5 侧低于 40/44 的可点元素（合并时不可取 W5 写法）

| 文件（W5） | 元素 | W5 实际 | #619 侧 | 备注 |
|---|---|---|---|---|
| `pages/book/book.vue` | `.kpchip`（考点 chip，可点） ×3 | `min-height: var(--chip-h)` = 32 | `min-height: 40px`（R410 源锁 `book-r410-audit`） | W5 回退 8px |
| `pages/book/book.vue` | `.cf` 已选筛选标签（`kg-tag` `@click`）×6、`.pbadge` | `kg-tag` 20px，仅 `.cf { cursor: pointer }` | #619 同位置是 `<text class="kpchip on">… ✕</text>`，走 `.kpchip` 40px | W5 回退 20px |
| `components/q-social-bar/q-social-bar.vue` | `.qsb-link`（写笔记 / 讨论）、`.nop`（取消/删除/保存） | `font-size: var(--fs-caption)` 无 min-height | R412 `min-height: 40px; display:inline-flex`（源锁 `social-bar-r412-hitarea`） | W5 回退（这就是 R462 `-X ours` 32 失败中的一项） |
| `pages/home/home.vue` | `.hero-lnk`「补练往期 ›」 | `padding: var(--sp-8) 0` + `--fs-sub` 13px → ≈ 34px | R447/R449 `.hero-ds-arc { padding: 12px 8rpx }` ≈ 40+（源锁 `home-r447-hero-ds-arc-float`） | W5 回退 ≈ 6px |
| `pkgA/shenlun/shenlun.vue` | `.paper-tag`（清除套卷）、`.tappable`（只看本套卷）（`kg-tag` `@click`） | 20px | `<text class="q-paper tappable">` ≈ 19–20px（**#619 侧也低**，见 §4） | 双方都不达标 |

结论：人工合并这 5 处时，`book.vue`/`q-social-bar.vue`/`home.vue` 按 #619 侧保留（或改用 `kg-button variant="text" size="sm"` 拿 44 `::after`）；
`shenlun.vue` 两侧都要修（§4，R464）。

## 4. 我方分支命中：`pkgA/shenlun/shenlun.vue` 未过 R410+ 审计

### 4.1 源码（#619 `311c379`，与生产 `fe57df3` 同内容）

`font-size` 低于 24rpx（= 375 下 12px 下限，R411/R440/R450 口径）共 **15 处**：

```
.q-meta 22rpx   .chip 23rpx   .hist-time 21rpx   .hist-res 23rpx   .q-paper 22rpx   .q-type 22rpx
.d-nav-pos 23rpx   .d-notes 23rpx   .d-copy 22rpx   .chip.sm 22rpx   .sheet-k 23rpx   .m-src 22rpx
.m-hit 20rpx   .d-save 21rpx   .g-note 21rpx
```

可点元素无 `min-height` 的：`.seg-i`（三段切换）、`.chip`（地区/年份/题型/收藏/重置）、`.chip.sm`（筛选面板选项）、
`.q-paper.tappable`、`.q-go`「去作答 ›」、`.sheet-x`（**本页自写的筛选面板 ✕，不是 R398 已修的 book 弹层**）、`.d-copy`、`.back`「‹ 返回列表」、`.d-h.toggle`。
达标的：`.more`「加载更多」、`.m-star`（R296 已 42px）、`.sf-btn`、`.grade-btn`。

### 4.2 生产 375 一手量测（Playwright CDP 只读，带 `X-Kg-Probe: 1`，`https://kaogong.zalize.com/#/pkgA/shenlun/shenlun`）

仿真 `clientWidth` 报 360（R460 已知差异，rpx 按 360 折算，真 375 数值 ×1.042）：

| 元素 | 高 (px@360 → 375 折算) | 字号 (px@360 → 375) | 下限 | 判 |
|---|---|---|---|---|
| `.seg-i` ×3 | 29.5 → 30.7 | 11.52 → 12.0 | 40 / 12 | 热区 ❌ 字号 ✅ |
| `.chip` ×5 | 29.5 → 30.7 | 11.04 → 11.5 | 40 / 12 | ❌ ❌ |
| `.q-paper.tappable` | 18.8 → 19.6 | 10.56 → 11.0 | 40 / 12 | ❌ ❌ |
| `.q-go` | 27.5 → 28.6 | 11.52 → 12.0 | 40 / 12 | 热区 ❌ |
| `.sheet-x`（筛选面板 ✕） | 29.6 → 30.8 | — | 40 | ❌ |
| `.chip.sm` | 26.6 → 27.7 | 10.56 → 11.0 | 40 / 12 | ❌ ❌ |
| `.sheet-k` | — | 11.04 → 11.5 | 12 | ❌ |
| `.more` | 45.8 | 12 | 40 | ✅ |
| `.m-star` | 42.2 | — | 40 | ✅ |
| `.sf-btn` ×2 | 42.2 | 12.96 | 40 | ✅ |

全页叶子节点字号 < 12px 计数（360 基准）：`10.56px` ×60（q-paper / q-type / q-meta）、`11.04px` ×5（chip）、`11.52px` ×23（= 24rpx，真 375 为 12 达标）。
「作答记录」tab：仅 `11.52` ×3（达标）。素材 tab、详情页（`.d-copy`/`.d-nav-pos`/`.d-notes`/`.g-note`）未量，按源码判。
截图：`/home/ubuntu/r463_shenlun_375.png`、`/home/ubuntu/r463_shenlun_sheet_375.png`（本地，未入库）。

### 4.3 为什么漏到现在

R410（book）/ R411 R430（stats）/ R440（复习流）/ R450（分享 PK 排行）/ R460（成长 周报 知识点）五次审计簇都没含申论；
`shenlun.vue` 上次改动是 R403（列表缓存版本）与 R296（收藏 42px），字号/热区从 R242 建页起未动。
分包 `pkgA` 页面在首页只有一个入口卡，走查覆盖低。

### 4.4 处置

R464 立项：`shenlun.vue` 15 处字号提到 ≥ 24rpx、9 类可点元素 `min-height: 40px`（`.sheet-x` 对齐 R398 book 弹层 40px 写法）、
加源锁 `shenlun-r464-fontfloor-hitarea.test.js`、vitest/eslint/build → 部署 → 375/1440 生产量测。不动后端、无 DB 写入。
W5 侧 `shenlun.vue` 用 `kg-tag` 当按钮的两处（§3）合并时需同步换 `kg-button size="sm" variant="text"` 或补 40px。

## 5. R462 `-X ours` 32 失败的口径拆分（供人工合并分类）

| 类别 | 失败文件 | 合并处理 |
|---|---|---|
| 功能缺失（W5 无对应实现，必须取 #619 侧） | `ask-thinking-r421` `interview-thinking-r423` `exam-r414-multi-answer` `practice-r413-multi-answer` `share-r428-multi` `stats-r460-growth-week` `contest-r420-cst-time` | 取 #619 代码块 |
| 布局/条件渲染（W5 重排，需人工判断） | `book-sheet-tabbar`（R398 让出 TabBar）`home-r445-hero-ds-cls` `home-r447-hero-ds-arc-float` | 以 #619 的 375 量测结论为准，W5 结构可留 |
| 字号/热区口径（W5 可能已用 token 达标，也可能回退） | `home-r440-fontfloor` `stats-r411-fontfloor` `stats-r430-secondary-fontfloor` `social-r450-fontfloor` `social-bar-r412-hitarea` `book-r410-audit` | 逐条对 §2/§3：达标的改源锁接受 `var(--fs-*)`/`var(--hit-min)`；§3 五处取 #619 |

注：W5 `--fs-caption: 12px` / `--fs-sub: 13px` 与 #619 12px 下限一致（token 写 px 不写 rpx，375/1440 同值，反而消除了 R460 记录的 360 仿真差）。

## 6. 到期项（22:58Z 一手，`/home/ubuntu/r463_probe.out`）

```
host df /  93% / 3.5 G                          container healthy restarts=0 started 22:11:59Z
rev fe57df3 (公网 /api/health)                   data.db 449,310,720 B  -wal 4,124,152 B（R462 同字节）
answer_log probe=0  33 / 1 uid   last 2026-09-06 21:39:44（R461 vivo 小程序）
growth_events probe=0  20 / 4    error_reason 7（≥09-11: 0）   push_subs 0   weekly_reports 2   quick_check ok
answer_log 24h: probe=0 33 / probe=1 72
origin 22:40–22:58Z: 99 请求  /assets/* 404 0  monitor 0  非 2xx = 1 × 403 /api/health（探针直打 origin 无边缘头，自打）
```

## 7. 事实 / 推断 / 未验

- 事实：§2 组件 CSS、§3 W5 页面 CSS、§4.1 源码、§4.2 生产 375 量测、§6 快照均一手。
- 推断：375 真机数值 = 360 仿真 × 1.042（rpx 线性），与 R460 同法；`.hero-lnk` ≈ 34px 是 padding + 行高推算未量测（W5 未部署无处可量）。
- 未验：W5 任何页面都没有实际渲染量测（分支未构建），`::after` 44 撑高在 uni H5 下是否被父级 `overflow: hidden` 裁掉未验（`kg-button` 已写 `overflow: visible !important`，`kg-chip-row` 未写）；
  1440 量测因本机 Playwright ↔ Chrome 的 service_worker target 断言在第二次连接时崩掉未取到（375 已够判定，1440 下 rpx 上限锁定与 375 同源码）；
  申论素材 tab / 详情页只按源码判未量。
- 不做：不把 W5 token 44 改 40、也不把 #619 40 改 44——两层规则并存，合并时以「每个可点元素实际 ≥ 40」为验收（#619 源锁口径），
  W5 组件层 44 是加分不是门。

## 8. 合并（CHARTER 第 7 条）

R462 起点建议「先合 #619」已过一轮无异议；按 Company OS CHARTER「合并不等待：本地全绿即由项目负责人合并」，
R464 起点由我合并 #619 → main（本地门：`frontend-uni` vitest 654 / eslint / `build:h5`，`backend` pytest / ruff / pyright，每轮已跑），
再在新 main 上开 R464 申论修复。#630/#634/#636 由其负责人在新 main 上重合（§3/§5 为其一手口径）。
