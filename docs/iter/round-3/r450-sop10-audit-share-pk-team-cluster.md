# R450 SOP-10 四维审计：「分享 / PK / 小队排行」簇（R427/R428 后首次整体复审）→ 4 页 28 处 <24rpx 字号抬到下限 + 3 处热区 ≥40px

生产 `27e8729` → `460120f`（bundle `index-BtSdXYlL.js` → `index-DXaDey5G.js`；后端不动、无 DB 写入；vitest +5 源锁）。

## 0. 竞品维度（如实）

对标粉笔错题本的「分享题 / PK / 排行榜」次级屏仍需登录账号，本轮**无一手竞品截图、零竞品陈述、不据二手加功能**；命中项全部依据本仓 R411/R430/R440 既定下限（正文字号 ≥24rpx、可点目标纵向 ≥40px）的源码与生产量测。

## 1. 审计范围与一手手段

| 维度 | 手段 | 结果 |
|---|---|---|
| ① 运营/管理实体 | 生产 `/data/data.db` 只读（`/home/ubuntu/r450_ro.py`）：`pk_matches` / `teams` / `team_members` / `shared_questions` / `shared_answers` / `growth_events` schema + 按 `COALESCE(probe,-1)` 分组计数 | 见 §2 |
| ② 核心用户功能 | 源码：`backend/app/pk.py`、`team.py`（share/team/track）、`frontend-uni/src/api.js`、`pkgA/pk/pk.vue`、`pkgA/team/team.vue`、`pkgA/share/share-q.vue`、`pkgA/share/pk-result.vue` 全读 | 见 §3 |
| ③ 落地/分发面 | 生产 HTTP：`/s/ZZZZ`、`/p/ZZZZ` 无效码、`/static/og-card.png`；`backend/app/seo/landings.py` | 无效码 302 → `/`，OG 卡 200，有效码 SSR OG + noindex + hash 跳转（源码） |
| ④ 架构/生产证据 | 容器 healthy、WAL、app-log；Playwright 375/1440 只读量测（`/home/ubuntu/r450/measure.py`） | 见 §4 |

## 2. 维度①：生产数据实况（只读，09-06）

- `pk_matches` 按 probe/status：NULL（历史）finished 1 / waiting 4；probe=1 finished 9 / waiting 13；**无显式 probe=0 对局**。近 7 天 finished 3 局全 probe=1。
- `shared_questions` 15 行、`shared_answers` 4 行（picked 全长 1）、`teams` 1、`team_members` 1 —— 这 4 张表**都没有 `probe` 列**，探针归因只能经 `growth_events` / 镜像到 `answer_log` 的行推断（R427 已登记的结构事实，本轮复核不变）。
- `growth_events` 该簇事件：`share_open` NULL 29 / probe=0 2 / probe=1 15；`share_copy` NULL 8 / probe=0 1；`share_answer` NULL 4 / probe=1 1；`pk_result_open` NULL 22 / probe=1 14；`pk_result_challenge` NULL 2；`team_join_open` NULL 16 / probe=1 24；其余各 1。probe=0 的 3 行与 R446 已归因的「vivo 持有者第二入口」同源，**不构成外部真人作答证据**。
- 到期项：`answer_log` probe=0 仍 22 行/1 uid、`error_reason` 6/0、`push_subs` 0、`weekly_reports` 0、`daily_set_entries` probe=0 0、29/29 `next_review` 在 CST 00:00、WAL 1.79 MB、healthy 0 重启。

结论：该簇**没有任何可确认的外部真人使用样本**，审计只能以源码 + 探针流量为依据；不加社交证明/排行/分享转化类功能。

## 3. 维度②：源码走查（无功能缺陷命中）

- 分享：`api_share_create` 同 sharer/题/小队幂等复用 sid；`api_share_detail` 只对 sharer 或已作答者揭晓答案/解析/统计；`api_share_answer` `normalize_answer()[:8]` 支持多选串（R428 修）、拒自答/重复、镜像 `answer_log` 带 probe；统计走 `REAL_TRAFFIC`。
- PK：只出单选题；基础分 + 速度加成（毫秒封顶）；随机匹配按 probe 类隔离；`/api/pk/result` 只暴露 finished；周榜 CST 周一 0 点 + `REAL_TRAFFIC ∪ 本人对局`；前端提交失败先 `pkMatch` 核「已判分」再提示重试（避免重复提交）；随机等待 5 s 轮询、30 s 出邀请提示；未完成对局可续。
- 小队：邀请码加入、周榜、7 日打卡矩阵、催打卡/周战报文案复制、事件白名单 10 项。
- 状态：4 页均有 loading / error+重试 / 空态 / 等待 / 提交失败态。
- 未命中任何谓词/口径/幂等类缺陷 → **本轮不改后端**。

## 4. 维度④ 命中：字号与热区（源码 + 生产量测）

改前 grep（`font-size: (1x|20–23)rpx`，样式块）：`pk.vue` 9（`.sec-more/.lb-rank/.m-s/.m-badge/.nm/.timer-t/.tag/.res-meta/.copy`）、`team.vue` 11（`.t-sub/.rank-king/.rank-me/.wh-name/.wh-d/.mem-tag/.mem-sub/.remind-btn/.mem-done/.wk-n` 等）、`share-q.vue` 5（`.from-s/.tag/.tc-s/.exp-k/.ans-res`）、`pk-result.vue` 3（`.meta/.mid-res/.cta-s`）= **28 处**，375 下 10–11.5px。生产改前 Playwright 实测（`measure.py`）：`/s/fsb75lki` `<12px` = [`.from-s` 11, `.tag` 10.5]，`/p/OG433F` = [`.meta` 10.5, `.cta-s` 11.5, `.mid-res` 10.5]；PK/小队首页只读态无 <12px 文字（低字号类在对局/面板态才渲染）。

热区：`.rank-copy`「复制周战报」min-height 32px、`.remind-btn`「提醒 TA」36px、PK 模块 `.chip` 实测 33px（12rpx 上下 padding）→ 均 <40px。

折行风险预判（canvas measureText，页面字体）：`.timer-t` 最长文案「本题剩余 30 秒 · 答对+80，越快加成越高 · 第 10/10 题」12px 宽 282 < `.pk-top` 内容宽 311 → 仍单行；`.mem-sub` 12px 252 在 `.mem-l`（min-width:0）内折行不重叠。

## 5. 改动（`460120f`）

- 4 页 28 处 `font-size` 抬到 `24rpx`（sed 统一替换，无其它属性改动）。
- `team.vue`：`.rank-copy` 32→40px、`.remind-btn` 36→40px（min-height）。
- `pk.vue`：`.chip { min-height:40px; display:inline-flex; align-items:center; padding:0 26rpx }`（原 `padding:12rpx 26rpx`）。
- `tests/social-r450-fontfloor.test.js` +5：4 页样式块无 `<24rpx`/`<12px` 字号；`.rank-copy/.remind-btn/.chip` ≥40px（旧源上 5/5 先失败）。
- 本地 vitest 629（+5）/ eslint / build:h5 绿；后端无改动。

## 6. 复验

- 部署 rc=0（宿主 load 6.2 时镜像导出较慢但一次收敛），health rev `460120f`、bundle 一致 gzip 125 KB；6b 12 项全 OK（`/` perf 0.96 / LCP 2287 / CLS 0.06；`/tiku/` 1.00 / 947 / 0）。
- 生产 `measure.py` 复跑：4 页 × 2 视口 `<12px` 全 `[]`、无横向溢出、`.chip` 42px、`/api` 非 2xx 0。
- testing agent（`r450-ui-a/b`，375×812 DPR2 守卫 cw==375 / 1440×900，全程 `X-Kg-Probe:1`；录屏 `/home/ubuntu/screencasts/r450-regress/r450-regress-edited.mp4`，报告 `/home/ubuntu/r450_test_report.md`）(a)–(d) 全 PASS：PK A 建局 `HQQVXK` 答 10 题（`.timer-t` 12px 单行 h17、`.nm` ellipsis）→ 等待态结果页复制挑战码/链接 toast → 大厅 `.m-s/.m-badge/.lb-rank` 12px → B 应战答完双方 finished → `/p/HQQVXK` `.meta/.mid-res/.cta-s` 12px；小队 `r450tm`：`.rank-copy` h40 →「周战报已复制」、`.remind-btn` h40 →「催打卡文案已复制」、7 个 `.wh-d` 同 top 不重叠、`.mem-sub` 右缘 267.3 < `.remind-btn` 左缘 276.3、`.wk-cell` 26px 内 `.wk-n` 12px 无裁切；分享 `lry72g98`（单选）/ `wzqed9lv`（多选 q273031，B 选 AC → 「正确答案 ACD」）揭晓态 `.exp-k/.ans-res/.tc-s/.tag` 12px；13 个量测页 `<12px []`、无溢出、console/pageerror 0、`/api` 非 2xx 0；容器 healthy 0 重启、日志 5xx/Traceback/locked 0；清理 9 表 27 行 → LEFTOVER 0，pk 27 / teams 1 / shared 15 / shared_answers 4 回基线。
- 如实登记：1440 下 `.remind-btn` 未量到（切视口时双方当天均已作答，按钮按 `today_n==0` 条件不渲染；CSS 与视口无关，375 已实测 40px）；设置期 SW 一次服务旧 bundle、一次仿真掉到 cw 360 的假象均排除后重量。

## 7. 未验证 / 限制

- 真机字体度量未验（DevTools 模拟）；`.timer-t` 单行结论依据 canvas measureText + 生产 CDP 量测。
- 该簇无外部真人样本，所有交互复验均为探针；不据此推断真人转化。
- 竞品无一手，功能层未做任何比对。
