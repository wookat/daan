# R568：更多操作层标题「组名 · 简称」+ 统计页 0 作答总正确率「—」+ sheet-history 关层后前向导航不补跳（研究 → 论证 → 实修）

线上基线：后端 `09d664a4`（health），H5 静态层 `index-CLSTMI1s.js`（R567 热修 `6ae243a0`，PR #747 待合入）。分支 `devin/1788991520-r568-more-title-stats-history` 从 #747 分支开（含线上谱系与 #742–#747 未合入提交），PR #748。

## 研究（一手）

### ① 新 375 生产截图走查（`~/r568/shots.py` / `shots2.py` → `~/r568/shots/`，探针 uid `test-r568-shots-375`，mistake id 4118–4125）

- 有效证据：`book.png/.txt`（错题本 8 条）、`book-more.png/.txt`（更多操作层）、`stats-cold.png/.txt`（冷 context 统计页）、`stats-tab.png`（底部 tab 进统计）、`stats-f5.png`（统计 F5）、`reqs.json`（30 请求全 200）、`mids.json`。
- **无效证据**：`stats-top.png` 抓到的是复用的错题本内容不是统计页（选择器等错），不作统计页依据；后续用路由专属选择器 + 标题校验重拍。
- 统计页（`stats-cold.txt`）：探针只有 8 条错题、0 条 `answer_log`；`/api/stats` 回 `by_module` 4 组 / `by_type` 7 项 / `by_reason` 空 → `hasData()` 为真渲染整页仪表盘（登录 banner / 累计刷题 0 / 能力预测 0/30 / 今日待办 8 题 / 12 周热力图 / 五模块雷达空态 / 错题模块分布 / 高频错题型 / 掌握度地图 / 学习计划 / 成就 0/8），但 hero 显 **「0% 总正确率」**——0 作答不是 0% 正确，与同页「能力预测：数据积累中」的口径不一致。
- 更多操作层（`book-more.txt`）：探针题型 `翻译推理`（无组名前缀）标题「翻译推理 · 更多操作」正常；R567-1 登记的 raw「法律-个税 · 更多操作」形态需 `type_group + 细分` 数据才出现（R567 生产二已坐实）。
- 复习页：8 条到期、内置复习入口正常，无 P0/P1，不立项。

### ② R567-1 更多操作层标题（源码）

- `book.vue` 标题绑定 `tagName(moreSheet.m) + ' · 更多操作'`：`tagName` = `qtypeName(question_type)`（库内值，R567 热修口径）→ 「法律-个税」；同卡卡头已是 `type_group` chip「法律」+ `fineLabel(m)` 「个税」。
- 后端 `norm_qtype` 只去 7 个模块名前缀、redo 精确匹配 `question_type=?` → 标题只能改**展示**，`tagName`（筛选比较）/ `?qt=` / `redo?qtype=` 必须仍是库内值。

### ③ sheet-history 前向导航（生产复现 + 源码）

- 生产 `index-CLSTMI1s.js`：错题本开更多操作 → X 关层（哑条目留在栈上）→ 地址栏改 hash 到 `#/pages/stats/stats` 回车 → 统计页闪现后被拉回错题本。
- 源码：`popAction` 最后一条 `if (prev != null) return back`——把「从哑条目上离开、落到的不是本页真条目」一律当成「同页 Back 落到本页真条目」补 `history.back()`；地址栏/书签改 hash 是**新建条目**（`history.length` 增）或落到别页（`pageKey` 变），与真实 Back（长度不变、同 `pageKey`）可区分。

## 论证结论

- 立项 ① 更多操作层标题走 `groupKey · fineLabel`（与卡头同口径；无细分时回落 `tagName`，手录/答题格式/未知模块行为不变）。
- 立项 ② 统计 hero `totalDone === 0` 显 `—`（`hasData()` 不动，错题派生仪表盘仍展示）。
- 立项 ③ `popAction` 加 `away`：`prev != null && land == null && (history.length > histLen || pageKey(href) !== prevKey)` → 不补跳；同页 Back 仍补跳，哑条目链（R562/R563）/ `?mod` 变体语义不变。
- 不立项：复习页信息层级（无 P0/P1）；`hasData()` 口径；Cloudflare beacon（R566-1 等老板）。

## 实修（`ffe75090`，仅 H5，0 后端/小程序）

- `book.vue`：`moreTitle(m)`；标题绑定改 `moreTitle(moreSheet.m) + ' · 更多操作'`。
- `stats.vue heroStats`：`value: this.totalDone ? this.accPct + '%' : '—'`。
- `sheet-history.js`：`popAction(prev, land, isOpen, skipping, away = false)`；`syncPrev()` 统一维护 `prev/prevKey/histLen`（`noteRouteChange` / `onPop` / install / `sheetOpened`）。
- 测试：`tests/r568-more-title-stats-acc.test.js`（标题 8 种输入、三处原值源锁、stats `—`、`hasData` 不变）、`tests/r568-sheet-history-away.dom.test.js`（jsdom 按 vue-router 4 顺序 `noteHistoryPop()` → `noteRouteChange()`：改 hash 留统计页 / 同页 Back 补跳 / 层开着 Back 关层 / 3 条哑条目链）；`book-r516-tagname-answer-format.test.js` 标题绑定源锁按新契约更新（有意契约变更）。
- 本地门：H5 vitest 188 文件 1455 / `npm run lint` 0 error（20 warn 同 main）/ build:h5（`index-B6W2qzqD.js`、`pages-book-book.CartAHwA.js`）/ `git diff --check` 空。
- 发版：宿主仍被同机 `LinkShopProxyHub` build + 两个 `docker builder prune` 挤（load 21 / mem_avail 240MB / disk 95%），后端 0 改动 → 同 R567 **只跑 `deploy_h5.sh` 4c/5/5b/6 段**（`~/r568/pages_deploy.sh`，日志 `pages_deploy.log`）：Pages `8c3e76d1.kaogong-h5-zalize.pages.dev`，线上 bundle `index-CLSTMI1s.js → index-B6W2qzqD.js`（一次 5s 重试后一致），七种 Accept-Encoding 全 `application/javascript`，7 项回归 200，线上 book chunk 含 `moreTitle`、stats chunk 含 `this.totalDone?this.accPct+"%":"—"`；health 仍 `09d664a4`（rev 对账留 `DEPLOY_RESUME=1`）。未跑 4a2 审计行与 6b LH。

## 生产复验（Pages `index-B6W2qzqD.js` / 后端 `09d664a4`，两轮，`~/r568/prod/report.md`，PR #748 评论附截图）

**结论：部分 PASS，环境阻塞，不判整轮通过。**

| 项 | 375 | 1440 | 结果 |
|---|---|---|---|
| A 更多操作标题「组名 · 简称」四种（法律·个税 / 逻辑判断·加强削弱 / 政治·政治常识 / 手录回落）与卡面一致 | ✓ | ✓ | PASS |
| A' 法律四值：库内 `法律-个税` / 显示 `个税` / URL `qt=法律-个税` + F5 保留 / redo `qtype=法律-个税` → items 命中 4178 进 1/1「错题重练」 | ✓ | 筛选稳定态 ✓，redo 未跑 | 375 PASS / 1440 redo UNTESTED |
| A'' 层内错因 PATCH 保存 + GET 保持；删除确认取消无行丢失 | ✓ | — | PASS |
| B 统计 0 作答：`/api/growth total=0` + `/api/stats` 分布非空 → hero `—`，其余卡仍渲染；真答 1 题后 F5 100%（API/DB 各 1 条 answer_log） | ✓ | 未跑 | 375 PASS / 1440 UNTESTED |
| C1 关层后地址栏改 hash → 留新页不回退 | 阻塞 | 阻塞 | UNTESTED |
| C2 真实同页 Back 补跳哑条目 | 阻塞 | 阻塞 | UNTESTED |
| C3 层开着 Back 关层不离页 | 阻塞 | 阻塞 | UNTESTED |
| C4 多哑条目链 | 阻塞 | 阻塞 | UNTESTED |
| C5 `?mod` 变体 | 阻塞 | 阻塞 | UNTESTED |
| 部署身份：线上 index/book Script 与本地 dist SHA256 一致；最后成功 health `09d664a4` | ✓ | — | PASS |
| 末次 `/api/health` 可用性 | 30.005s 超时 curl 28 / 000 | — | FAIL（宿主） |

- 环境阻塞事实：fresh 冷 context 错题本冷加载 + 两次 UI 重试失败，唯一非 2xx `GET /api/review` HTTP 520（cf-ray `a389c99ef937aee3-PDX`）；独立 curl 同窗 `/api/health` 19–44s / 60s 超时、`/api/mistakes` 17–81s + 1×520。宿主只读：load 21–28、mem_avail 91–233MB、disk 95%，同机 `LinkShopProxyHub` build + 2×`docker builder prune` + celery heavy + recruit postgres + web-admin vite。**推断**：宿主级可用性 P0，非本 PR 代码；未 kill 他家进程、未叠 build。
- **既有 P2 R568-1**（另列）：1440 带筛选 F5 冷加载先渲染缓存 5 张未筛选卡 + 待复习 0，~30s 真实回包后收敛为 1 卡 + 待复习 5。cache-first 首屏 vs 稳定态，非 R568 引入；慢 origin 下用户可感知。
- 审计：一轮 934 请求 = 811 HTTPS 200 + 111 data URL + 12 取消，133 API = 129×200 + 4 abort；fresh 282 = 238×200 + 20 data URL + 1×520 + 23 API abort。两轮 console error / runtime exception / rejection 0；Browser Log 网络 error 1（=520）、SW 注册 warning 7（Playwright harness）。track 5/2 条全 200，所有 API `probe=1` 双证。
- 清理：一轮本人前缀 0→20→0、`test-r568-%` 全部 16→36→0（含授权 shots UID `test-r568-shots-375` 8 mistakes + 8 growth_events）；fresh 0→7→0。独立 41 表只读两次 0 残留；共享 `test-r562-modal-%` 42 行、五类 count/hash、papers/题库保持。偏差：fresh 删除回执 SSH 280s 超时无 JSON，未重复 DELETE，以只读复核为准。
- 未验：C1–C5、1440 redo/B、逻辑/政治组 redo、收藏持久化、复习专项、小程序/真机、真实 SW/offline、其它浏览器、跨设备。待宿主恢复后专项补测。
- 录像：`~/screencasts/r568-a-b-375/r568-a-b-375-edited.mp4`、`~/screencasts/r568-a-b-1440/r568-a-b-1440-clean.mp4`（后者仅标题/缓存首屏，不证 1440 redo/B/C）。
