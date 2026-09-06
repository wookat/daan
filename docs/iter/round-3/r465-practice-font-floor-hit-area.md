# R465 · 核心作答页（`pages/practice/practice.vue`）首次过 R410+ 字号下限 / 40px 热区审计——修复 + 部署 + 375/1440 生产复验

原定起点是「R464 发版后 (c) 补量 + 全仓盘点其它『带底色小标签当按钮』」。只读盘点（`r465_scan.py`，生产 375 仿真）先命中一个比申论页更重的漏审：
**产品主循环「练习 → 作答」的作答页本体**（每道题都经过）从未过 R410+ 审计——源码样式块 40 处 `19–23rpx`、header 答题卡入口 `.tag` 生产一手 **20.8px** 高（直接可点，无外层撑高）、答题卡抽屉 ✕ `.sheet-x` **27.7×35.3px**。
R430–R464 历轮选簇（每日一练 / 复习流 / 分享 PK / 成长周报 / 申论）都绕过了这个页面。按 R464 同法立项：只改 **1 个前端文件（`<style>` + 1 行模板）+ 1 个源锁**，后端不动、无 DB 写入。
生产 `04ef7f7` → `c3326e4`（同一分支 PR #619，base=main，仍 open 待人工 Merge）。

## 1. 结论先行

1. **字号**：样式块 40 处 `19–23rpx`（375 下 9.5–11.5px）全部提到 `24rpx`（12px 下限，R411/R412/R464 同口径）。其中 11 处是模板已不引用的死规则
   （`.custom-note .goal-chip .set-sub .set-chip .new-tag .daily-s .smart-s .mn .searchbar .sub-prog .sub-n`，模块选择屏早已迁出本页），一并抬只为让源锁「样式块内无 <24rpx」一条正则可锁，不删死规则（超范围）。
   真正渲染到用户面前的 29 处：header `.tag .timer .cnt .fire-n .mchip .fontbtn .op`、题干区 `.real-tag .grp-tag .offline-tag .qimg-credit .qhl-tip .mat-fold-t/-a`、解析区 `.exp-k .tm-cmp .hs-rate-btn .hs-rate-done .report-link`、
   答题卡 `.acard-foot .kbd .kbd-d`、完成页 `.ring-t .report-t .report-tip .mb-name .mb-pct .rr-l .rr-tip .dsb-mine .dsb-score .wr-meta .ann-b`、nudge `.duenudge-s`。
2. **热区**（页面层 40px 口径）——按模板逐个核「谁真的挂 `@click`」后只动可点元素，纯信息标签（`.real-tag .grp-tag .mchip .cnt .exp-k` 等）只改字号不撑高：

   | 元素 | 语义 | 改前（375 生产一手） | 改法 |
   |---|---|---|---|
   | `.tag` 「言语理解 · 1/10 ▾」 | 打开答题卡（整页唯一入口之一） | 20.8px，直接 `<text @click>` | 模板改 `<view class="tag" role="button"><text class="tag-t">`：外层 `flex; min-height:40px; margin:-10px 0`，视觉底色/省略号移到 `.tag-t` |
   | `.op` 「退出」 | 退出练习（弹小结） | 14px 裸文字 | `inline-flex; min-height:40px; margin:-10px 0 -10px 6rpx` |
   | `.fontbtn` ★ / ··· | 收藏 / 练习工具 | `::after inset:-16rpx` → 命中带 ≈36px | `inset: -12px -16rpx` → 42px |
   | `.sheet-x` ×3 | 关闭 工具/答题卡/纠错 抽屉 | 27.7×35.3 | `inline-flex; 40×40; margin:-6px -10rpx -6px 0`（`.sheet-h` 28px 不变） |
   | `.lead-x` | 关闭领跑提示 | 28×28 | 40×40，`margin:-6px -8rpx` |
   | `.mat-fold` | 展开/收起同上材料 | ≈29px | `min-height:40px` |
   | `.hs-rate-btn` ×2 | 花生解析「有用/有误」 | ≈25px | `min-height:40px; padding:0 22rpx` |
   | `.report-link` | 「题目有问题？纠错」 | ≈18px（padding-top 14rpx + 11px 字） | `flex center; min-height:40px; padding-top:6rpx` |
   | `.deep` | 「用花生十三方法详解」 | ≈29px | `flex center; min-height:40px; padding:0` |
   | `.rp-chip` | 纠错类型 chip | `min-height:44rpx`（=22px，无效值）| `min-height:40px; padding:0 26rpx` |
   | `.wr-btn` | 「强化 5 道新题」 | ≈27px | `inline-flex; min-height:40px; padding:0 22rpx` |
   | `.rr-go` | 「回错题本查看 ›」 | 12px 裸文字 | `flex; min-height:40px; margin:-2px 0 -8px`（吃卡片下 padding，不抬卡高） |
   | `.duenudge-go` ×3 | 去复习 / 去登录 / 开启推送 | ≈27px | `inline-flex; min-height:40px; padding:0 30rpx` |
   | `.loginnudge-x` ×2 | 关 nudge | ≈29px | `inline-flex; 40×40; margin:-6px -10rpx -6px 0` |
   | `.fixreport` | 纠错回执整行 | ≈39px | `min-height:40px` |

   原已达标不动：`.tool-row` 44、`.opt`、`.rz` 40、`.acard-n` 40、`.bnext/.multi-ok/.pskel-quit/.lf-btn` 44、`.btn`。
3. **header 行高不变**是本轮硬约束：`.rhead` 改前后都是 **20px**（375/1440 生产一手），`.tag/.op` 的 40px 命中带靠 `margin: -10px 0` 上下各吃 10px 到进度条/模式 chip 行，`elementFromPoint` 中心 ±20/−19 命中（40px 带）。
4. **一处代价与补救**：`.tag` 22→24rpx 后文字变宽，375（360 仿真）下「言语理解 · 1/10 ▾」需 112px 而可用 105px → 出省略号（改前 103px 刚好不出）。
   补救：`.hstats gap 12→8rpx`（5 个间隙 −10px）、`.op` 不加水平 padding → 可用 115px ≥ 112，复验 `scrollWidth ≤ clientWidth`，无省略号；带子模块名/连击 🔥 chip 时仍会按设计走省略号（改前同）。
5. **`.tag` 没用 R464 的 `::after` 法**：它是 header 里独占左侧的元素，不与并排信息标签比高，用「外层 40px 容器 + 负外边距」更直接（`::after` 在 `<text>` 上还要改成 `<view>`）。R464 结论不变：并排带底色小标签才用 `::after`。
6. 到期项无增量（§4）；(c) 部署窗口 origin 200 请求 `/assets/*` 404 0 / monitor 0；perf 随部署一次全 OK（`/` 0.94 / LCP 2354 / CLS 0.06；`/tiku/` 1.00）。
7. **WAL 首次到达 R455 预测阈值**：`data.db-wal` 3,164,192 B（768 帧，R436–R464 连续同字节）→ **4,124,152 B = 1001 帧**（(4124152−32)/4120），mtime = 本轮容器重启时刻；与 R455「到 1000 帧自动 checkpoint 后从头复用、文件停在高水位」一致，下一轮看是否同字节。

## 2. 本地门

- `npx vitest run` **642/642**（+4 源锁 `frontend-uni/tests/practice-r465-audit.test.js`）；`npx eslint src --ext .vue,.js` 0；`npm run build:h5` 绿（bundle `index-R0UH4e4-.js` gzip 126 KB ≤ 160 KB）。
- 本地 dist 预检（R464 法：`http.server 8765` + Playwright CDP，`/api/**` GET 转发生产带探针头、非 GET abort）375/1440 数值与部署后生产逐项一致（§3）。

## 3. 生产复验（`c3326e4`，Playwright CDP 只读，`X-Kg-Probe: 1`，非 GET 全 abort → 无库写入）

| 元素 | 375（`clientWidth` 360 仿真） | 1440（1425） |
|---|---|---|
| `.rhead` 行高 | 20 → **20** | 20 → **20** |
| `.tag` 高 / 命中带 | 20.8 → **40** / ±20·−19 = 40 | **40** / 40 |
| `.tag-t` 视觉 | 21.8px 高，`scrollWidth ≤ clientWidth`（无省略号） | 23px |
| `.op` 退出 | **40** / 命中带 40 | 40 |
| `.fontbtn` 命中带 | 19.9 本体 / **42** | 20 / 42 |
| `.sheet-x`（答题卡） | 27.7×35.3 → **40×40** / 命中带 40；`.sheet-h` 28 | 40×40 / 40 |
| `.hs-rate-btn` ×2 | **40** | 40 |
| `.report-link` / `.deep` | **40** / **40** | 40 / 40 |
| `.rz` ×3 / `.bnext` | 40 / 44（原） | 40 / 44 |
| `.qsb-link` ×3（R412） | 40 | 40 |
| `<11.9px` 叶节点 | 作答前 7 / 作答后 22，**全部 11.52px = 24rpx 仿真值**（R460/R464 同一限制），0 个 <24rpx | **0** |

截图：`r465_prod_q_375.png`（header 单行、标签无省略号）、`r465_prod_card_375.png`（答题卡 ✕ 40×40）、`r465_prod_after_375.png`（解析区 有用/有误 / 纠错 / 详解 40px）、1440 同名。

## 4. 到期项（23:36Z，`c3326e4` 起后 2.5 min，严格 `WHERE probe=0`）

| 项 | R464 | R465 |
|---|---|---|
| `answer_log` probe=0 行/uid | 33/1 | 33/1（末条 09-06 21:39:44Z，vivo 小程序设备） |
| `growth_events` probe=0 | 20/4 | 20/4 |
| `mistakes.error_reason` 非空 / ≥09-11 | 7 / 0 | 7 / 0 |
| `push_subs` / `weekly_reports` | 0 / 2 | 0 / 2 |
| `quick_check` | ok | ok |
| 24 h `answer_log` probe 0/1 | — | 33 / 72 |
| WAL | 3,164,192 B | **4,124,152 B（1001 帧，§1.7）** |
| 容器 | healthy restarts=0 | healthy restarts=0（23:34:00Z 重建） |
| (c) 部署窗口 origin | 184 请求 404/monitor 0 | 200 请求 `/assets/*` 404 0 / monitor 0 / 小程序 UA 0；非 2xx 仅 `304 /sw.js` ×3、`304 /robots.txt` ×1 |
| 宿主盘 | 93% / 3.8 G | **94% / 3.1 G** |

## 5. 未做 / 如实说明

- 375 为 360 仿真直读、真机未量；11.52px 是 24rpx 的仿真差异（1440 同节点 12px）。
- 完成页（`.wr-btn .rr-go .duenudge-go .loginnudge-x .fixreport .rp-chip`）与领跑提示 `.lead-x`、材料折叠 `.mat-fold` 未在生产真实走到（需完整做完一组 / 深链 / 同材料题组 / 提交纠错），只按源码 + 本地 dist 同规则推断；源锁已锁。
- 无 testing agent 录屏（未另行授权），量测为 Playwright CDP 只读脚本。
- 其它只读盘点数值（未立项，需语义确认）：搜索页 `.tab` 25.7 / `.scancel` 20；讨论页 `.msg` 15；个人页 `.zl-link` 16；面试页 `.hist-link` 18 —— 需逐个核是否有外层撑高，留 R466。
- 原定「(c) 补量」在本轮部署窗口一并完成（§4），「全仓 `::after` 盘点」只做了作答页与上表 5 处读数。
