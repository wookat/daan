# R513：复习多选题作答卡 + 完成态 / 退出恢复态 375/1440 只读整页审 → 命中「完成复习关闭庆祝后落在错题列表中段」→ `exitReview()` 回页顶

日期：2026-09-08（UTC 09-07 22:0x–22:4x）。分支 `devin/1788816465-r510-precache-practice-first`，PR #640 追加。
生产 `8a4bc53e` → `10e2eb82`。

## 0. 结论

1. **(c) / 到期项 0 增量**：R512 容器 5xx/assets 404/monitor/mpUA/非探针 POST/401·403/Traceback 全 0；probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0；公告「详情」/`mistakes_total` 非探针触达无样本；复习真人证据全史仍只 09-06 那 1 条 `POST /api/review/1952`，`review_log` 自 09-07 起 0 行。无新的外部真人证据。
2. **多选复习卡**：生产到期项里 `len(correct_answer)>1` 的错题 **0 道**（题库多选题 13/156792），无真样本 → 用合成样本（`/api/review` GET 在 CDP `Fetch` 层 stub 为 1 道多选，非 GET 全 abort）在改前生产 dist 上过状态机：选 A → `sel`、再选 C → A/C `sel`、再点 C 取消 → 只剩 A、确认按钮文案随选实时变「确认答案（已选 A）」→ 确认 AB（正确 AC）→ A `ok`/B `bad`/C `ok`/D `dim` + 判词 + 错因 chips + 「下一题」。**H5 多选状态机与 R512 铺文本的选项行兼容，不改。** 如实：这是浏览器本地合成数据，不是生产/真人多选证据。
3. **退出恢复态**：`umst3` 30 题到期真数据只读进复习 → 答完 Q1 到 Q2 → 直接刷新 → 恢复卡「上次复习中断在第 2/23 题 · 进度已保留，可原位继续 · 放弃 / 继续复习」→ 「继续复习」回到 `复习 2/23` 且题干与刷新前 Q2 完全一致（375/1440 均 `RESUMED-MATCH-Q2 True`）；本地 `reviewSnap` 18 KB、`rIdx=1/n=23`、uid 匹配。恢复链路正常，不改。
4. **完成态命中**（改前生产 375，合成 1 道到期）：复习卡高 **988 px**（题干 674 + 选项 4×44），作答/「完成复习」要**下滚 ≥400**；庆祝弹层「今日复习已清零 · 到期 1 道全部复习完成 · 首答对 1 道（100%）」正常；点「太棒了，继续 ›」后 `exitReview()` 只切 `reviewing=false` + `load()`，**页面滚动位置不变** → 错题本头卡（到期/预计/累计统计 + 「开始复习」CTA）top **−613**，用户落在错题列表中段、看不到刚清零的到期状态。1440（视口 900、卡 593 高）不用滚动，头卡 top 68 正常——**问题只在小视口**。
5. **修**（`10e2eb82`，`book.vue` 1 行 + 源锁 2 例）：`exitReview()` 末尾 `uni.pageScrollTo({ scrollTop: 0, duration: 0 })`。完成复习与「退出复习」按钮同一出口，手动退出同受益。**不动**庆祝弹层/状态机/`load()` 顺序。
6. **复采**（改后生产）：375 关闭庆祝后头卡 top **56**、CTA「开始复习」top 140、`sheets=[]`、`resume=null`、`docSW==cw`、`errs []`；1440 头卡 68 不变。本地 dist 同值（`~/r513/local_complete_375.out`）。
7. **小程序端源码核（W7/main `miniapp-native/miniprogram/pages/book`）**：`resetQ()` 已按 `cur.options[k]` 组 `rOpts[].text`，`book.wxml` `wx:if="{{item.text}}"` 铺文本 + `r-opts-full/r-opt-full` 样式在 `book.wxss` 存在 → **不是 R512 那种裸字母形态**（源码结论，未在微信开发者工具跑）。多选 `onReviewPick`（toggle + sort）/`onConfirmMulti` 与 H5 同构。两处差异登记给 W7：① `exitReview()` 同样不回页顶（`wx.pageScrollTo` 缺）；② `celebrateN = rItems.length`，H5 是 `filter(!_extra && !_requeued)`，小程序「N 道到期错题全部复习完成」会把错题重排 + 自动加练题算进 N。

## 1. 边界与方法

- 全部读数为本机 Chrome（CDP `localhost:29229`）对生产 `https://kaogong.zalize.com/#/pages/book/book`，`X-Kg-Probe: 1`，uid `umst3tuisd7lgzaka`（只读）；`/api/**` 非 GET 在 CDP `Fetch` 请求阶段全 abort。
- 三种模式（`~/r513/review_states.py <375|1440> <resume|complete|multi>`）：
  - `resume`：真数据；进复习 → 答 Q1（POST abort）→ 下一题 → 刷新 → 断言恢复卡 + 继续复习后题干一致。
  - `complete`：`GET /api/review` stub 为 1 道真格式到期题（联查题库结构化 `options`）→ 答对 → 「完成复习」→ 庆祝 → 关闭 → 量头卡/CTA/弹层/滚动。
  - `multi`：同上但 stub 为 1 道 `correct_answer="AC"` 的合成多选题 → 过 pick/unpick/confirm。
- 「点了」的如实说明：`resume` 模式点了 Q1 一个选项与「下一题」，`POST /api/review/<id>`、`/api/review/cur`、`/api/track` 全 abort；事后核 `umst3` 自发版起 `mistakes/answer_log/growth_events/review_log` 新增 0、`mistake 1953` `review_count 0 / next_review NULL / mastered 0` 未变（`~/r513_pre.out` / `~/r513_post.out`）。
- 小程序端为源码只读，未运行。

## 2. 改前生产读数（`~/r513/*.out`，pre-fix dist `8a4bc53e`）

### 2.1 多选（合成样本）

| 步 | 375（选项 309×44） | 1440（726×44） |
|---|---|---|
| Q1 | 卡 343×463.5、`复习 1/1`、4 选项均带文本、确认按钮 `disabled` | 卡 760×440、同 |
| PICK-A | A `sel`；按钮「确认答案（已选 A）」可用 | 同 |
| PICK-AC | A/C `sel` | 同 |
| UNPICK-C | 只剩 A `sel`、按钮回「已选 A」 | 同 |
| CONFIRMED-AB（正确 AC） | A `ok` / B `bad` / C `ok` / D `dim`；判词「答错了，看讲解（稍后本轮会再出现）（下次复习：3 天后）」；错因 chips ×4；「下一题」309×44 | 同，宽 726 |
| errs | [] | [] |

### 2.2 退出恢复（真数据 `umst3` 23 题：20 到期 + 3 自动加练）

| | 375 | 1440 |
|---|---|---|
| 刷新后头卡 / CTA | [343,144.5] top 55 / 「开始复习」309×44 | [696,144.5] top 68 / 662×44 |
| 恢复卡 | 343×95 top 212「上次复习中断在第 2/23 题 · 进度已保留，可原位继续」；放弃（`kg-btn--md` 36 可视 + `::after` 命中 40）/ 继续复习 106×44 | 696×76 top 225 |
| 继续复习 | `复习 2/23`，题干 = 刷新前 Q2（True） | True |
| 本地 `reviewSnap` | 18,097 B，`rIdx 1 / n 23 / uid ✓` | 同 |

### 2.3 完成态（合成 1 道到期，真格式）

| | 375（视口 800） | 1440（视口 900） |
|---|---|---|
| Q1 卡 | 343×**988** top 56；题干 309×674；选项 top 815–971（须下滚） | 760×593；选项 top 432– |
| 答后 | 判词「答对了！连对 1 次（下次复习：3 天后）」；「完成复习」309×44 | 同 726 |
| 庆祝 | 底部 sheet 375×263「今日复习已清零 / 到期 1 道全部复习完成 · 首答对 1 道（100%）」；✕ 44×44；「太棒了，继续 ›」343×44 | 居中弹层 480×255 |
| 关闭后 | `sheets=[]`、`resume=null`、`storage=null`；**头卡 top −613 / CTA top −529** | 头卡 top 68 / CTA 152 |
| errs | [] | [] |

## 3. 修

`frontend-uni/src/pages/book/book.vue`

```js
exitReview() {
  this.reviewing = false;
  this.clearReviewSnap();
  this.load();
  uni.pageScrollTo({ scrollTop: 0, duration: 0 });
},
```

源锁 `frontend-uni/tests/book-r513-exit-review-scroll-top.test.js`：`exitReview()` 含 `reviewing=false` / `clearReviewSnap()` / `pageScrollTo(0)`；完成复习分支与 `@click="exitReview"` 共用同一出口。

不改：庆祝弹层内容、`celebrateN`/`rSummary` 口径、`load()` 时序、恢复卡、多选状态机；不改小程序（登记 W7）。

## 4. 门 / 发版

- vitest 119 文件 / 836 例、eslint、`lint:tokens`、lint-pages 0 error（19 warn 既有）、`build:h5`、`git diff --check` 全绿；后端/native 未动。
- 发版 `--skip-build` rc=0（`~/r513_deploy.log`）：宿主 mem_avail 425 MB / 5.5 G / load 3.11 / 兄弟构建 0；**compose 重建 22:02→22:24 ≈ 21 min**——BuildKit 层缓存再丢（日志见 pip 全量装轮子，R469 同形态），非本轮改动；容器 `22:24:01Z rev=10e2eb82` healthy 0 重启；bundle `index-CBnn6O8E.js` 线上=本机、7 种 Accept-Encoding 均 JS；7/7 200；6b `/` 0.93 / a11y 1.00 / LCP 2807 / CLS 0.06、`/tiku/` 1.00。

## 5. 改后生产复采（`~/r513/post/complete_{375,1440}.out`）

| | 375 | 1440 |
|---|---|---|
| 关闭庆祝后头卡 top | **56**（改前 −613） | 68（不变） |
| CTA「开始复习」top | 140 | 152 |
| `sheets` / `resume` / `toast` | [] / null / [] | 同 |
| `docSW==cw` / errs | 375 / [] | 1425 / [] |

## 6. 发版后 (c)（`~/r513_post.out`，容器起 22:24:01Z 起 68 请求）

5xx/assets 404/monitor/mpUA/非探针 POST/401·403/Traceback 全 0、WAL `4,173,592` 同字节。**非探针非 bot 48 行 = 48 个不同 IP × 各 1 次 `GET /tiku/q/<id>` 200**，全部 `Accept-Language: en-US,en;q=0.9`、无 Referer、`Sec-Fetch-Mode: navigate`、UA 桌面 Chrome 107–136 轮换、无任何后续 assets/API 请求，集中在发版后 22:24:51–22:26 内；同 UA 集合全史只在 09-02 00h（5）/ 09-04 21h（24）/ 09-07 22h（48）三个整点簇出现 → **推断**为住宅代理分布式抓取，`access_log_report.classify()` 会把它们计为 `human`（候选真人）——登记，不改口径（一手只有请求头特征，无 IP 情报）。DB 侧 probe=0 各表与改前完全相同、`umst3` 0 新增。

## 7. 登记 / 未做

- W7 小程序：`exitReview()` 不回页顶；`celebrateN = rItems.length` 与 H5 口径不一致；微信开发者工具未跑（本轮只源码）。
- 多选复习卡仍无生产到期样本（题库多选 13 题）；合成样本只证状态机。
- 日报「候选真人」会计入上述 48 行住宅代理式单次抓取；是否加「单 IP 单次 + 无 assets + en-US」启发式待有更多样本再论证。
- 复习卡 988 px 高本身（长题干资料分析）未做折叠/粘底作答区——1 道合成样本不足以立项，等真人到期复习数据。
- 既有登记不变：错因 chip 行 375 末项被裁；`/api/profile` 收已过日期（R505）；6b Lighthouse 取样策略；宿主级 / 证书。

## 8. 产物

`~/r513/review_states.py`、`~/r513/{resume,complete,multi}_{375,1440}.out` + 对应 png（改前）、`~/r513/local_complete_375.out`（本地 dist）、`~/r513/post/complete_{375,1440}.out` + png（改后生产）、`~/r513/gate.out`、`~/r513_pre.sh`→`~/r513_pre.out`、`~/r513_post.sh`→`~/r513_post.out`、`~/r513_deploy.log`。
