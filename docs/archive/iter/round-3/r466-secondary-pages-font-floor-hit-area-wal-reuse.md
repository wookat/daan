# R466 · 搜索 / 讨论 / 个人 / 面试四页字号下限 + 可点元素 40px 热区（R465 遗留 5 处读数语义确认→修复→部署→375/1440 复验）+ WAL 高水位复用坐实

R465 只读盘点留下 5 处「读数小但语义待确认」的元素：搜索页 `.tab` 25.7 / `.scancel` 20、讨论页 `.msg` 15、个人页 `.zl-link` 16、面试页 `.hist-link` 18（375 仿真 px）。
本轮先按「先调查再发言」核源码模板 + 生产 DOM：**5 处全部是直接挂 `@click` 的叶节点，外层没有任何撑高容器**（所在行高就是它们自身高度），不是「外层已够 40 只是内层读数小」。
随后按 R464/R465 同法修：只改 **4 个前端文件的 `<style>`**（0 行模板、0 后端、无 DB 写入）+ 1 个源锁。生产 `c3326e4` → `7e2e2b3`（同一分支 PR #619，base=main，仍 open 待人工 Merge）。

> 源码路径勘误：R465 handoff 里按页名猜的 `pages/search/search.vue`、`pkgA/discuss/discuss.vue` 不存在，实为 `pkgA/search/search.vue`、`pkgA/social/discuss.vue`（生产路由 `#/pkgA/search/search`、`#/pkgA/social/discuss?qid=`）。

## 1. 结论先行

1. **5 处语义确认（改前生产一手，375 仿真 / 模板结构）**：

   | 元素 | 模板 | 改前高 / 字号 | 外层 | 判定 |
   |---|---|---|---|---|
   | 搜索 `.tab` 全部/题目/花生解析 | `<text class="tab" @click>` | 25.7 / 12.48px（26rpx） | `.tabs` 行高 = 25.7 | 真可点、无撑高 → 修 |
   | 搜索 `.scancel` 取消 | `<text class="scancel" @click>` | 20 / 13.44px | `.sbar` 32.3（输入框行） | 真可点、无撑高 → 修（不能抬 `.sbar`） |
   | 讨论 `.msg` 消息 | `<view class="msg" @click="goInbox">` | 15 / 10.56px（22rpx） | `.chips` 行 ≈24（chip 23.7） | 真可点、无撑高 → 修 |
   | 个人 `.zl-link` ×N 产品/隐私/条款 | `<text class="zl-link" @click="zlOpen">` | 17 / 12px | `.zl-links` flex-wrap 行 = 17 | 真可点、无撑高 → 修 |
   | 面试 `.hist-link` 练习记录 › | `<view class="hist-link" @click="goHistory">` | 19 / 13px | 独占一行 block = 19 | 真可点、无撑高 → 修 |

   同页顺带命中的其它可点元素（模板逐个 `grep @click` 核出）：搜索 `.sclear`（清空输入 ✕）/ `.hist-clear` / `.hist-chip` / `.d-copy`（AI 详解）/ `.retry`；讨论 `.chip`（最热/最新）/ `.up`（赞）/ `.op`（回复·举报·删除）/ `.rx`（取消回复 ✕）/ `.send` / `.plaza-btn` / `.retry`；面试 `.swap`（换一题）。
2. **字号**：4 页样式块共 **27 处 `20–23rpx` → `24rpx`**（搜索 5 / 讨论 11 / 个人 5 / 面试 6），纯信息标签（`.q-code .q-real .q-mod .t-sub .cnt .tag .qans .tm .stat-t .badge-* .acct-sub .hero-n .hero-meta .cat-sub .q-tag .q-src .zl-copy`）只改字号不撑高。
3. **热区**（页面层 40px 口径，同 R410+/R464/R465）——全部 `min-height: 40px`，不抬所在行的用负外边距：

   | 元素 | 改法 | 行高影响 |
   |---|---|---|
   | 搜索 `.tab` | `inline-flex; min-height:40px; padding:0 28rpx`（药丸 25.7→40） | `.tabs` 行 +14px（页签行本来就是独立行） |
   | 搜索 `.scancel` | `inline-flex; min-height:40px; margin:-4px 0` | `.sbar` **32.3 不变** |
   | 搜索 `.sclear` ✕ | `inline-flex; min-height:40px; margin:-12px 0; padding:0 8rpx` | 输入框内 `.sbox` 不变 |
   | 搜索 `.hist-clear` / `.hist-chip` / `.d-copy` / `.retry` | 40px（chip 用 `line-height:40px` 保 ellipsis） | — |
   | 讨论 `.chip` / `.msg` | `inline-flex; min-height:40px`（`.msg` 与 chip 同行，行由 chip 撑到 40） | `.chips` 行 24→40 |
   | 讨论 `.up` / `.op` | `inline-flex; min-height:40px; margin:-12px 0` | 评论底行 `.ft` 不变；去掉 `.up.sm, .op.sm` 20rpx 覆盖 |
   | 讨论 `.rx` ✕ / `.send` / `.plaza-btn` / `.retry` | 40×40 / `height:40px` / 40 / 40 | — |
   | 个人 `.zl-link` | `inline-flex; min-height:40px; margin:-4px 0`；`.zl-links gap 8→16rpx` | 两行文字链的 40px 命中带恰好相接（375 重叠 1.3px、1440 1px，见 §5） |
   | 面试 `.hist-link` | `flex center; min-height:40px; margin-top 28→8rpx` | 视觉位置基本不动 |
   | 面试 `.swap` 换一题 | `inline-flex; min-height:40px; margin:-10px 0` | 题卡 meta 行不变 |
4. **生产复验（§3）**：5 处 + 顺带元素在 375/1440 全部 **40 / `elementFromPoint` 命中带 40**；`.sbar` 32.3 不变；四页 `<11.9px` 叶节点只剩 `24rpx` 仿真 11.52px 与 uni TabBar label，**0 个 <24rpx**。本地 dist 预检数值与生产逐项一致。
5. **WAL 高水位复用坐实（R455 预测 / R465 挂起项闭合）**：`data.db-wal` 仍 **4,124,152 B（同字节）**，但直接解帧：`ckpt_seq 0 → 1`、salt 已换、**1001 个帧槽里只有 55 帧持新 salt 有效**（最后 commit 帧 idx 54）→ 1000 帧 autocheckpoint 已发生、WAL 从头复用、文件大小停在高水位。主库 mtime 22:09:44Z（checkpoint 写回时刻，早于 R465 23:36Z 读数——R465 看到的 4,124,152 B 其实已是 checkpoint 后的高水位）。到期项口径维持 R455：仅 > 64 MiB 且持续 > 1 天才立项。
6. 到期项无增量（§4）；(c) R465 发版后 305 请求 `/assets/*` 404 0 / monitor 0；perf 随部署一次全 OK（`/` 0.96 / LCP 2302 / CLS 0.06；`/tiku/` 1.00 / LCP 987）。

## 2. 本地门

- `npx vitest run` **650/650**（+8 源锁 `frontend-uni/tests/secondary-r466-audit.test.js`：四页「样式块无 <24rpx」×4 + 每页热区规则 ×4）；`npx eslint src --ext .vue,.js` 0；`npm run build:h5` 绿。
- 本地 dist 预检（R464 法：`http.server 8466` + Playwright CDP，`/api/**` GET 转发生产带探针头、非 GET abort）375/1440 数值与部署后生产逐项一致。

## 3. 生产复验（`7e2e2b3`，Playwright CDP 只读，`X-Kg-Probe: 1`，非 GET 全 abort → 无库写入）

| 元素 | 375（`clientWidth` 360 仿真） | 1440（1425） |
|---|---|---|
| 搜索 `.tab` ×3 | 25.7 → **40** / 命中带 40，字 12.48px | 40 / 40 |
| 搜索 `.scancel` | 20 → **40** / 40；`.sbar` **32.3 不变** | 40 / 40；`.sbar` 33.6 |
| 搜索 `.sclear` ✕（有 kw 时） | **40** / 40 | — |
| 搜索 `.q-code .q-real .q-mod .t-sub` 信息标签 | 15.9–17.9 高，11.52px（=24rpx，改前 9.6–10.6） | — |
| 讨论 `.chip` ×2 / `.msg` | 23.7 / 15 → **40 / 40**，命中带 40 | 40 / 40 |
| 讨论 `.send` | **40** | 40 |
| 讨论 `.tag .qans .cnt` 信息 | 11.52px（改前 9.6 / 11.04 / 10.56） | 12px |
| 个人 `.zl-link` ×7 | 17 → **40** / 命中带 40；`.zl-links` 行 32、两行命中带相接 | 40 / 40 |
| 个人 `.stat-t .badge-d .acct-sub .zl-copy` | 11.52px（改前 11 / 11 / 11 / 11） | 12px |
| 面试 `.hist-link` | 19 → **40** / 命中带 40 | 40 / 40 |
| 面试 `.cat-sub .hero-n` | 11.52px（改前 11） | 12px |
| 四页 `<11.9px` 叶节点 | 全部 11.52px = 24rpx 仿真 + `uni-tabbar__label` ×5（个人页 TabBar，uni 内置） | **0** |

截图：`r466_prod_search_375.png`（页签 40 药丸、搜索行不变）、`r466_prod_search_results_375.png`（有结果态：清空 ✕ 40、信息标签 24rpx）、`r466_prod_discuss_375.png`（最热/最新/消息 40 一行）、`r466_prod_profile_375.png`、`r466_prod_interview_375.png`。

## 4. 到期项（23:52Z，`7e2e2b3` 起后 2 min，严格 `WHERE probe=0`）

| 项 | R465 | R466 |
|---|---|---|
| `answer_log` probe=0 行/uid | 33/1 | 33/1（末条 09-06 21:39:44Z，vivo 小程序设备） |
| `growth_events` probe=0 | 20/4 | 20/4 |
| `mistakes.error_reason` 非空 / ≥09-11 | 7 / 0 | 7 / 0 |
| `push_subs` / `weekly_reports` | 0 / 2 | 0 / 2 |
| `quick_check` | ok | ok |
| 24 h `answer_log` probe 0/1 | 33 / 72 | 33 / 72 |
| WAL | 4,124,152 B（1001 帧） | **4,124,152 B 同字节；`ckpt_seq 1`、有效帧 55/1001 槽（§1.5）** |
| 容器 | healthy restarts=0 | healthy restarts=0（23:50:21Z 重建，rev `7e2e2b3`） |
| (c) R465 发版后 origin（23:36Z 起） | — | 305 请求 `/assets/*` 404 0 / monitor 0 / 小程序 UA 0；非 2xx 仅 `304 /sw.js` ×4、`304 /robots.txt` ×2 |
| 宿主盘 | 94% / 3.1 G | **93% / 3.7 G** |

## 5. 未做 / 如实说明

- 375 为 360 仿真直读（11.52px = 24rpx 仿真差异，1440 同节点 12px），真机未量；无 testing agent 录屏（未另行授权）。
- 未在生产真实走到的态：搜索历史区（`.hist-clear/.hist-chip` 只在 kw 为空且有历史时渲染，`uni.getStorageSync('kgSearchHist')` 注入后同页 hash 只改 query 不触发 `onLoad`，本轮改用新页打开只验了有结果态）、搜索详情 `.d-copy`、讨论页有评论时的 `.up/.op/.rx`（生产该题 0 条讨论、无法只读构造）、面试题卡 `.swap`（需抽题）——这些按源码 + 本地 dist 同规则 + 源锁推断。
- 个人页两行 `.zl-link` 的 40px 命中带在 375 重叠 1.3px / 1440 重叠 1px（`gap 16rpx` = 7.68px < 8px），落在缝上的点归上行文字链；不再加 gap（再加即抬页脚高度），登记不改。
- 讨论 `.chips` 行 24→40（+16px）、搜索 `.tabs` 行 25.7→40 是有意的（独立行，R460 `.gw-tab` 同法），不是回退。
- WAL 帧解析只核 salt 与 commit 标记未校验 checksum（R455 同）；「checkpoint 发生在 ≤22:09:44Z」按主库 mtime 推断，未取 SQLite 内部日志。
- 第一版到期项脚本把 `question_text_backup`（`created_at` 为 TEXT `'2026-08-02 …'`）误报为「23:36Z 后有写入」——TEXT 与 `strftime('%s')` 字串比较 `'2'>'1'` 恒真，已核实该表 234 行全是 R80 备份、最新 08-02；结论「R465 后无业务写入」不受影响。
- 仍无可确认外部真人作答者、`WX_MINIAPP_SECRET` 未配、R385 第二冷样本未达标；`www.zalize.com` 证书 10-04 到期、宿主盘扩盘/迁出待定。
