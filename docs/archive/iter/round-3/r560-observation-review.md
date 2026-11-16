# R560：观察项回看（practice_stay_here / 错因填写率 / relink GET / 蒙题簇回访 / 分发通道）+ 生产 UX 走查——研究先行

日期：2026-09-09。生产 rev `bf36ec10`（#729），本轮研究阶段无代码改动。

## 1. 研究范围（R559 handoff 登记）

① `practice_stay_here` ≥3 天自然样本；② 错因填写率在 R558 下移 + R559 可取消后 ≥7 天回看（基线 2.5%，probe 分账）；③ `bf36ec10` 后自然恢复场景 relink GET 是否出现；④ 蒙题簇（≥7 连快答 5 uid）是否回访；⑤ 自然 `via='answer'` / `source='daily'`；⑥ 小程序真机 / probe 真人口径。

## 2. 生产只读证据

数据源：`file:/data/data.db?mode=ro`（`~/r545/q560.py`…`q560f.py`，经 `remote.py` 在 `deploy-kaogong-1` 内执行）+ caddy 源站 JSON 访问日志 14 天（`~/r545/log560.sh`…`log560e.sh`）。口径：`uid not like 'test-%' and coalesce(probe,0)=0`，日志按 UA / `X-Kg-Probe` / Referer 分账。

### 2.1 ① `practice_stay_here`：自然行 0

- `growth_events` 非测试非探针 `practice_stay_here` = **0**。688d530c（09-05）以来非测试作答仅 09-06/09-07 各数行、09-08/09-09 共 3 行——不是「没人点看解析」，是**没有自然作答流量**可产生该事件。→ 1200ms 自动推进继续**不改**。

### 2.2 ② 错因填写率：样本不足以判定

| 窗口 | 有错因 / 错题 | 比例 |
|---|---|---|
| 全期 | 7 / 287 | 2.4% |
| 30 天 | 5 / 198 | 2.5% |
| 7 天 | 4 / 84 | 4.8% |
| 3 天 | 1 / 61 | 1.6% |

7 天 4 行错因（概念不清 2 / 方法不会 1 / 纯蒙的 1）来自内部走查设备口径的 uid（见 2.4），**不能归因为真人填写率变化**。继续观察，不立项。

### 2.3 ③ relink GET：日志层不可分辨

恢复侧 relink 请求与错题本列表加载同为 `GET /api/mistakes?uid=`，H5 Referer 只有站点根、小程序 Referer 只有 `servicewechat.com/<appid>/<ver>/page-frame.html`，caddy 日志无法区分「恢复回填」与「打开错题本」；DB 侧无对应事件。60h 内非测试该 GET 331 条，全部来自内部走查（devtools/真机走查设备/Linux X11）。→ **无自然恢复样本可证**，登记为「需显式标记才可度量」，本轮不加打点（纯遥测非用户可感知）。

### 2.4 ④ 蒙题簇回访：5 uid 仅 1 个回访，且为内部走查设备

- 回访的 `umst3tuisd7lgzaka`：45 作答 / 32 错题 / 5 段会话 / 3 活跃日，UA 三种（Linux X11 Chrome 1171 请求、`servicewechat.com/wx01f2f29cfe51baba/0/`（小程序开发版）Android vivo V2405A 504 请求、iPhone UA 79 请求），`reminder_optin` ×3 + `reminder_prefs wxsub 20:00`、`wxlogin` 503 ×4（`WX_MINIAPP_SECRET` 未配，R386/R425 已登记）。handoff R386/R425 已登记同机为 **MiniProgramEnv 内部走查设备**，本轮维持该归类。
- `u17`（36 作答 / 26 错 / 0 错题，08-15 单日，含 `reinforce`/`search` 来源，`merged_anon r26-a`）、`u26`（08-29 单日 + 2 次模考）、`u32`（09-02 单日 + 2 次模考）均为单日注册账号形态、无回访。
- 结论：蒙题簇无真人回访样本，**「刷题模式」不立项**。

### 2.5 ⑤ `via='answer'` / `source='daily'`

- `review_log.via='answer'` 非测试非探针 **0** 行；7 天 `answer_log.source`：NULL 101 / `direct` 2，`daily` 0。全期 source 分布：NULL 979 / direct 51 / session-report 10 / share 7 / reinforce 5 / redo 1 / search 1。→ 继续观察。

### 2.6 ⑥ 小程序真机与错误面（新一手证据）

- caddy 14 天小程序侧请求：devtools 2513 / 真机（`servicewechat.com/wx01f2f29cfe51baba/0/`）705；真机活跃日 09-03/06/07/08。真机非 2xx 仅 `POST /api/auth/wxlogin` 503 ×4（资源缺口，既定）+ `GET /` 403 ×1；devtools 侧 404/403 全为负向用例。真机路径面覆盖 `mistakes/review/answer_log/practice/progress/exam/favs/reminders/share` 等 40 个端点，全 200。
- 这证明**开发版小程序已在真机跑通主链路**，但仍是内部设备，**不等于真机验收**（R536-1 累计项措辞不变）。

### 2.7 分发通道与「真人」口径（研究附带，决定本轮走向）

- 14 天源站日志：搜索引擎 Referer 合计 16（Google 15、Baidu 1，其中多数落在 `/.env`/`/.git/config` 等扫描路径 → 非真人）；蜘蛛到达 YandexBot 1284 / ClaudeBot 496 / GPTBot 229 / SemrushBot 204 / bingbot 193 / Googlebot 108 / **Baiduspider 1** / Sogou·360·Bytespider 0。robots.txt 允许 `/tiku/`，本机模拟 Baiduspider/Sogou/Bytespider UA 均 200（无 UA 级封禁；边缘 IP/ASN 级不可从源站证）。
- 排除内部 UA/探针后的 HTML 导航：`/` 86、`/tiku/` 35，其余为 WordPress/.env 扫描；按 UA 多日活跃的「候选真人」仅 Windows Chrome（10 天）、moto g power（7 天）、Mac（5 天）三个，均无法与作答 uid 关联。
- 09-01 `GET /api/exam/report/{72,73,75}` 404 ×70044 + `POST /api/exam/submit` 502 ×2622 全部 Linux X11 Chrome/137 + `X-Access-Code` 头、峰值 255/min → 同机压测/harness，非真人。14 天其余 5xx/429/400/404 逐组归因均为 curl/Linux X11/探针（部署窗口 503、限流用例、已删题 id）。
- 结论与 R95 一致且更强：**生产当前没有可确认的外部真人**；①②③④⑤ 全部依赖自然样本，在分发到位前不会有结论。分发资源（Baidu/Bing/Sogou/360 站长验证、微信公众号 JS-SDK、`WX_MINIAPP_SECRET`、小程序正式发布）R95/R386 已一次性申请，本轮再次登记为**唯一阻塞**。

## 3. 研究结论与本轮走向

- ①–⑤ 全部「无自然样本」，**不立项**；不改 1200ms、不做刷题模式、不加 relink 遥测。
- 既然数据维度无法产出候选，本轮改走「真实操作台 / 首页落地页 UI」维度：以新游客冷 context 一手走查 R544–R559 未覆盖的错题本核心路径（空态 → 首错 → 卡面 → 更多操作层逐项 → 错题分析 → 筛选），只对**复现的确定性缺陷**立项，结果见 §4。

## 4. 生产 UX 走查（bf36ec10，新游客冷 context，testing agent 独立执行）

报告：`~/kaogong-reports/r560-wrong-book-ux-bf36ec10-prod-walkthrough.md`（账本 `network-audit.json` / `events.jsonl`，全程 `X-Kg-Probe: 1`，uid `test-w560-*`，收尾 41 表精确清 22 行 0 残留）。路径：冷错题本空态 → 去刷题真实 10 题（8 对 2 错、不选错因）→ 列表/卡面 → 更多操作层逐项（错因选/改/取消、练 3 道同类、同考点 5 道、掌握/取消掌握、纠错表单、分享、删除）→ 收藏追查 → 统计 → 筛选/URL 持久 → 1440 抽检。

| # | 级别 | 现象 | 结论 |
|---|---|---|---|
| F1 | **P2 功能** | 题页收藏 QID182003（`POST /api/favs` 200）→ 错题本「收藏」tab 取消收藏 → 本地列表消失，但**无 DELETE 请求**，`question_favs` 行仍在；「收藏夹与笔记」页与同 uid 新隔离 context 仍显示 1 题 | **本轮立项实修**（§5） |
| F2 | P2 可访问性 | 更多操作层 Escape 不关、Tab 焦点落背景卡、浏览器 Back 直接回首页 | 登记 R560-1，下轮论证（涉及 uni-popup 层通用行为，非单页小改） |
| F3 | P3 视觉 | 375 空态说明 line-clamp 2 裁掉「右下角「＋」可扫描…」 | 登记 R560-2 |
| F4 | P3 视觉 | 375 长试卷标签 20/23px 纵向裁切（1440 不复现） | 登记 R560-3 |
| F5 | P3 文案 | 删除确认无「不可恢复」提示、无撤销 | 登记 R560-4 |

PASS：空态/去刷题、造数与 DB 一致、错因选/改/取消 PATCH+SQL NULL、练同类/同考点入口、掌握/取消掌握、删除持久化、统计口径、筛选 URL 持久 + 切统计回来保留、1440 抽检。UNTESTED：完成页「返回错题本」字面 CTA（实际路径不经过）、`/api/mistakes/analysis`（<3 题无入口）、小程序/读屏/跨设备/离线/全部筛选组合。

## 5. F1 设计论证与实修（H5）

### 5.1 源码核实（根因）

- H5 有**两套收藏存储**：本机 `favQuestions`（localStorage，刷题页顶栏星星 `practice.vue toggleFav` / 模考报告 `exam-fav.js toggleFav` 写入；错题本「收藏」tab 与「我的」收藏计数只读它）与云端 `question_favs`（`/api/favs`，收藏夹页 `pkgA/social/favorites.vue` 读它并按题干合并本地条目）。
- 刷题页 `toggleFav` 收藏/取消**双写**（本地 + `setFav/removeFav(qid)`），模考报告 `toggleDetailFav` 同样双写；但错题本 `book.vue unfav(i)` **只 splice 本地并落盘**，且本地条目 schema `{t, question, options, ...}` **不存 qid**，即使想同步云端也无 id 可用 → 取消收藏后云端残留，收藏夹页合并时云条目仍在（本地条目按题干已去重），其他设备/context 亦见——与走查现象逐项吻合。
- 小程序错题本收藏 tab 走云端 `fetchFavs/deleteFav`（`pages/book/book.ts onUnfav`），**无此分叉**，本轮小程序不改。

### 5.2 样本 / 标签 / 验证方式 / 与现状对比

- 样本：走查 F1 一手复现（`network-audit.json` favs POST 1 / DELETE 0；`row-final-extra.json` 保留该行；`fav-followup-cloud-375.png`）。生产非测试 `question_favs` 存量不作为立项依据（无法区分「本机取消未同步」与「未取消」）。
- 标签：本地态（favQuestions）/ 云态（question_favs）/ 收藏夹页合并态 三者在「错题本取消」后应一致为「未收藏」。
- 修法（最小、只 H5，0 后端/协议改动）：① `practice.vue toggleFav` 与 `exam-fav.js toggleFav` 本地条目补 `id`（题库题 qid；时政/内联为 `null`）；② `book.vue unfav` 先落本地（现状不变）再 `unfavCloud(f)`：`cloudFavId(f)` 有 id 直接 `removeFav`，历史无 id 条目 `fetchFavs()` 按题干回查云列表命中才删（时政本地收藏不会误删云端）；云端失败不回滚本地（与刷题页 `removeFav(...).catch(() => {})` 同口径）；补 toast「已取消收藏」。
- 验证方式（生产黑盒）：题页收藏 → 错题本取消 → 期望 `DELETE /api/favs?uid&question_id` 200、DB `question_favs` 行消失、收藏夹页与新 context 均 0；历史无 id 条目路径：预置不带 id 的 `favQuestions` + 云端同题 → 取消时 `GET /api/favs` 回查 + DELETE；时政本地条目取消 → 无 DELETE。
- 与现状对比：修前 DELETE 0 / 云残留；修后双写一致，刷题页/模考报告/错题本三处取消收藏口径统一。

## 6. 实修落地与生产复验

- PR #731（`devin/1788941921-r560-research`，从 main `e25b6c93`（#730）开，已合入 `10667e8c`）：`exam-fav.js`（`toggleFav` 条目补 `id` + 新纯函数 `cloudFavId`）/ `practice.vue toggleFav` 补 `id` / `book.vue unfav → unfavCloud` / 测试 `exam-fav.test.js`（+5）、`book-r560-unfav-cloud-sync.test.js`（源锁 +3）；6 文件 +172/-5（含本文档）。
- 本地门：H5 vitest 176 文件 **1299**（+8）/ eslint 0 error（lint-pages 20 warn 与 main 基线逐字一致）/ tokens check / build:h5 / `diff --check` 空；后端、小程序 0 改动未跑。
- 发版：`deploy_h5.sh --skip-build`（`DEPLOY_WAIT_SECS=900`）`bf36ec10 → 9c31576b`，bundle `index-DzMqodGp.js`（gzip 125KB），谱系闸 OK、compose 单次 rc=0、6/6 接口回归全 200；6b LH `/` 0.99/**0.94**/0.96/1.00（a11y 0.94 为容器刚重建 warm-up 形态，R554 同）→ 独立重跑两次 a11y 1.00，但 `/` performance 0.85/0.86、LCP 3560/3507ms **两次违例**（发版时 1833ms）；`/tiku/` 三次全 1.00 / LCP ≤880ms。R560 未改首页任何文件、bundle 体积不变，第三次 0.85/3672ms、第四次仅 performance 0.85/LCP 3713/FCP 2629（simulate 150ms RTT，curl 直连 `/` TTFB 99ms、bundle 82ms 无异常）→ 发版后 4 次连续违例、发版 6b 同 bundle 1833ms 通过；R560 未改首页任何文件、bundle hash/体积与 6b 通过时一致，无法归因本轮，登记 R560-5（`/` LCP 首屏关键路径 HTML→index→pages-home chunk 是否需 preload/内联）下轮先复采再论证；不作 R560 回归结论也不粉饰。
- 生产黑盒（testing agent，`~/kaogong-reports/r560-unfav-cloud-sync-9c31576b-prod-verify.md`、`~/r560v-9c31576b/`、录像 `~/screencasts/r560v-9c31576b-{mobile,desktop}/`，#731 评论附截图；uid `test-w560v-*`，全程 probe）：
  - A 375：题页星星收藏 QID322075 `POST /api/favs` 200、`favQuestions[0].id === 322075` → 错题本取消 → `DELETE /api/favs?uid&question_id=322075` 200、toast「已取消收藏」、本地清空、只读 DB 行消失；原 context 与同 uid 新冷 context「收藏夹与笔记」均 0 题（修前同路径为 1 题残留）。**PASS**
  - B 历史无 id 条目（QID283148 云端收藏 + 预置无 id 本地条目 → F5 → 取消）：先 `GET /api/favs` 200 再 DELETE 200，DB 消失。**PASS**
  - C 不误删（本地条目题干云端不存在）：仅 GET 200、**无 DELETE**，本地清空，云 QID182176 行与 UI 不变。**PASS**
  - D 回归：练习页星星收藏/取消仍 POST/DELETE 200；取消最后一条回 `tab='todo'`、收藏 chip 计数消失；R559 错因选→改→同项取消恰 3 个 PATCH、DB 值→值→NULL、四 chip `aria-pressed=false`。**PASS**
  - E 1440 完整 A 路径 **PASS**。云失败边界（有意 abort DELETE）：本地不回滚、云行保留、toast 仍出（指定语义）；解除后云页取消 DELETE 200 恢复。
  - 审计：1160 请求 = 1156 配对 200 + 2 导航图片取消 + 1 有意 abort + 1 关第二 context 前未获终态的 preload（UNTESTED）；probe 缺失 0；console/runtime/rejection/loading warn/付费 0；41 表精确清 5 行 0 残留，五类 hash/count 起终一致。
  - UNTESTED：小程序、模考报告收藏 writer 完整入口（仅单测）、真实时政/内联 `id:null` writer 入口、HTTP 非 2xx（非 abort）失败、重复题干多云匹配。
- 登记（未修）：R560-1 更多操作层键盘模态（Escape/焦点圈定/Back）；R560-2 375 空态说明 line-clamp 裁切；R560-3 375 长试卷标签纵向裁切；R560-4 删除确认无「不可恢复」措辞/撤销。
