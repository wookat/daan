# R558：错答反馈信息层级（错因自评下移到主解析之后）+「看解析」取消自动推进埋点——UX 设计论证 / 实修 / 生产复验

日期：2026-09-09。代码 PR #725（分支 `devin/1788930105-r558-wrong-feedback-order`，自 main `5f5f6fbc`＝#724），已合入 main `2a507e8d`。生产 `0e42420f → 688d530c`（`index-CBqwpdi1.js`）。后端仅 `api_track` 白名单 +1 事件。

## 1. 设计论证（先论证，再改）

R557 走查登记的两条 P2：P2-1 错答反馈区后续内容纵深 ≈565px；P2-2 答对 ≈1.2s 自动推进无预告。本轮要求「先论证不直接改，对标粉笔/夸克择一小改」。

### 1.1 现状源码一手核实

H5 `practice.vue` `.after` 区（改前顺序）：判定 `kg-banner` → **错因自评（选填）** `.reasons` → `kg-analysis-card`（解析 + 来源/知识点 + 社交条 + 解析反馈）→ 第二解析 `xp-card` → 已生成 AI 详解卡 → 「AI 详解」/「纠错」按钮。小程序 `practice.wxml` 同序（错因自评紧跟 banner，解析卡在后）。

答对自动推进：H5 `autoNext: uni.getStorageSync('autoNextOff') ? false : true`（默认开），答对 `setTimeout(1200)` → `next()`，banner 右侧「看解析」仅在 `autoTimer` 存活时出现，`stayHere()` 清定时器；工具面板「答对自动跳下一题」切换持久化 `autoNextOff` + `POST /api/profile auto_next`。小程序 `practice.ts` 同 1200ms，「看解析」按钮条件 `autoNext`，`onStayHere()` 清定时器。两端行为一致，且已具备「可预期」的三要素：可撤销（看解析）、可关闭（工具面板）、跨会话持久。

### 1.2 生产只读证据（`~/r545/q558.py` / `q558b.py` / `q558c.py`，非测试 uid，`probe` 分账）

| 口径 | 数值 | 含义 |
|---|---|---|
| 近 30 天 `answer_log` | 170 错 / 140 对，40 uid | 错答反馈是高频界面，不是边缘路径 |
| `mistakes` 有 `error_reason` | 全期 7/287（71 uid）；30 天 5/198；7 天 4/84 | **错因自评填写率 2–5%**：低频、可选 |
| `error_reason` 分布 | 概念不清 3 / 方法不会 2 / 纯蒙的 1 / 粗心大意 1 | 四值都有人用，不是无人使用 |
| `user_profile.auto_next` | 9 行全 NULL | 没有任何真人改过自动推进偏好（既没关也没显式开） |
| `review_log.via` 近 30 天 | 全 NULL（35 行） | 自然 `via='answer'` 仍 0 行（R553 起连续观察） |
| 答对→下一题作答间隔（近 100 对） | p25 2.6s / p50 9.3s / ≤1.5s 11% | 含下一题阅读作答时间，**不能**推出客户端定时是否触发 |
| 答错→下一题作答间隔（近 98 对） | p25 1.9s / p50 2.6s / ≤3s 58% | 同上，只说明错答后停留普遍很短（与蒙题簇混合，未分离） |
| `daily_set_entries` 非测试 | 1 行（09-06，`umtp…17`） | 该 uid 30 行作答全 `probe=1`、无 profile → 是探针不是自然样本；0e42420f 起自然 `source='daily'` 0 行 |

### 1.3 对标（如实区分一手/二手）

- 粉笔：官方页面一手可证「错题本自动收集练习/模考错题；条目含题目、我的答案、正确答案、解析、错因归因；支持查看/重做/归因/移出」——归因与解析并列，未证实其**答题页**反馈区的先后顺序与自动翻页时长。
- 夸克：公开检索结果集中在拍照搜题/OCR，**无**一手证据说明其错题本答题页层级与自动推进 → 标 unverified，不据此设计。
- 因此本轮不做「粉笔这么排所以我们也这么排」的推断，只用自家数据 + 阅读顺序论证。

### 1.4 论证结论与择一

- P2-1（层级）：错因自评填写率 2–5%，却排在 100% 会看的解析之前，把主要补救内容（为什么错）往下推；阅读顺序上也应先看解析再判断是「概念不清/方法不会/粗心/蒙」。**改**：错因自评下移到主解析卡之后、第二解析/AI/纠错之前；H5+小程序同口径；文案/交互/持久化/a11y 全部不变。改动是纯模板位移，风险最低、可感知。
- P2-2（自动推进）：机制已具备可撤销/可关闭/持久三要素；9 个真人 profile 无人改过偏好；相邻作答间隔不能分辨定时/手动 → **无一手证据支持改 1200ms 或改默认值**。只补观测：H5 `stayHere()` / 小程序 `onStayHere()` 追加 `trackEvent('practice_stay_here', source)`，后端白名单加入。后续用自然「看解析」点击率判断 1.2s 是否太急。
- 不做：≈565px 纵深本身不证明流失（无跳出/放弃数据）；不折叠来源/社交/第二解析；不改 banner 文案。

## 2. 实修（#725，8 文件 +129/-20）

- `frontend-uni/src/pages/practice/practice.vue`：`.reasons` 块从 banner 后移到 `</kg-analysis-card>` 后；`stayHere()` 追加 `trackEvent('practice_stay_here', this._source || 'practice')`。
- `miniapp-native/miniprogram/pages/practice/practice.wxml`：`.reasons` 移入 `exp-card` 内（解析/我的笔记之后、`exp-acts` 之前）；`practice.wxss` 加 `.exp-card .reasons` 分隔线；`practice.ts onStayHere()` 追加同名 `trackEvent`。
- `backend/app/team.py` `api_track` 白名单 +`practice_stay_here`；`tests/test_track_whitelist_sync.py` 接受事件列表 +1。
- 源锁测试：`frontend-uni/tests/r558-wrong-feedback-order.test.js`（banner→解析→错因→第二解析→动作 顺序、`（选填）`、四错因值、1200ms、「看解析」条件、`stayHere` 清定时器+埋点、白名单含事件）；`miniapp-native/scripts/wrong-feedback-order.test.ts`（同口径 + 分隔线样式 + `onStayHere`）。首版小程序源锁按 H5 定时器写法写错，对照 `practice.ts` 实现（`clearAutoTimer` + `_autoTimer=0` + `this.data.cur===cur`）改正。
- 本地门：H5 vitest 173 文件 1276 / eslint+tokens 0 / build:h5 DONE；小程序 tsc / eslint 0 err（20 既有 warn）/ vitest 59；后端 pytest 744 / ruff / pyright 0（须 `npx -y pyright --pythonpath /home/ubuntu/venv-kg/bin/python app`，裸 npx 用系统 python 报 jwt/pywebpush 2 假错）；`git diff --check` 空。
- 生产：`deploy_h5.sh` 全量 `0e42420f → 688d530c`（宿主无兄弟 build、disk 3.0G/94%、mem 305MB；compose 单次 rc=0 ~80s 收敛），bundle `index-CBqwpdi1.js` 一致、gzip 125KB、接口回归全 200、LH `/` 0.98/1.00/0.96/1.00、`/tiku/` 全 1.00。部署后冒烟 `POST /api/track practice_stay_here`（`X-Kg-Probe:1`，uid `test-r558-smoke-0001`）200。

## 3. 生产复验（独立 testing agent，`688d530c` / `index-CBqwpdi1.js`）

报告 `~/kaogong-reports/r558-wrong-feedback-688d530c-prod-verify.md`、证据 `~/r558v-688d530c/`（`runtime-evidence.json`/`network-audit.json`/`events.jsonl`/`final-db.json`/`clean.json`/`readonly-after-clean.json`），录像 `~/screencasts/r558-688d530c-{mobile,desktop,regression,regression-final}/`。PR #725 评论附截图。口径：冷隔离 context、uid `test-r558v-5eddf9f8`、全程 `X-Kg-Probe:1`、375×812 主测 + 1440×900 抽检 A/D。

| 项 | 结果 | 要点 |
|---|---|---|
| A 375 首错层级 | PASS | banner < 解析卡（解析/来源/知识点/社交）< `.reasons`「错因自评（选填）」< 第二解析 < AI/纠错；banner→错因 428.25px、banner→AI 按钮 861.02px（R557 ≈565px 只作对照，题/解析长度不同非控制实验） |
| B 错因选填/落库 | PASS | 选「概念不清」`aria-pressed=true` + PATCH 200 + DB 同值；改选「方法不会」落库；**重复点击不取消（再 PATCH 同值，既有行为）**；另一错题不选错因直接下一题 |
| C 自动推进 | PASS | 不点「看解析」→ CDP 实测 1187.60ms 进下一题 |
| D 看解析停留 + 埋点 | PASS 375/1440 | 点击后 72ms/66ms 动作消失、3.1s 仍同题；`POST /api/track` 200 `event=practice_stay_here source=practice`；`growth_events` id 2779/2780 `probe=1` |
| E 偏好关/开 + F5 | PASS | 关闭后答对不跳、无「看解析」，F5 `autoNextOff="1"`；重开恢复自动跳，F5 `autoNextOff=""` |
| G 回归 | PASS | 每日一练首错错因在解析之后（`daily.date=今日/past=false`、`source=daily`）；R555 到期标签 Q6/10 可见（**fixture 调整**：刚答错的题被「近 30 分钟已答排除」暂不混入，改用 1 条 probe `POST /api/mistakes` 未作答题库 fixture，已披露并清理）；「再来一组」1/10；redo 完成页 primary/ghost/「返回错题本」落点不变 |
| 审计 | PASS | 666 请求/666 响应全 200（199 API，probe 缺头 0）；阻断/取消/资源失败/console error+warning/runtime/rejection/loading 配对 warn/付费 AI-OCR 全 0；harness 定位超时 3 次另计（冷首页 CTA 为「免注册立即开练」、答题卡格子非 button、uni 弹窗 role），均改真实控件 |
| 清理 | PASS | 41 表精确删本 uid 39 行 + 部署冒烟 `test-r558-smoke-0001` 1 行；exact/prefix/smoke LEFTOVER 全 0；五类 hash/count 起终一致（中途 +16 行全本 uid，本轮无并发漂移） |

UNTESTED：小程序（R536-1 累计）；1440 除 A/D 外流程；`redo`/`daily` source 的「看解析」专项；慢网/跨设备偏好恢复；R555 完整 exclude 边界；流失因果；粉笔/夸克当前版本实机。

testing agent 附带 UX 建议（未实现、待论证）：定时器存活时 banner 明示「约 1.2 秒后自动下一题」、动作改「停留看解析」——本轮不采纳，等 `practice_stay_here` 自然样本再定。

## 4. 下一步（R559 候选）

- `practice_stay_here` 自然样本 ≥3 天后回看：看解析点击/答对 比例；若显著（例如 >20%）再论证 1.2s 是否延长或默认改「停留」。
- 错因自评下移后 ≥7 天回看填写率（基线 30 天 5/198 = 2.5%，7 天 4/84）——注意 probe 分账。
- 自然 `via='answer'` / `source='daily'`（0e42420f 起）继续观察。
- R555-1 计时分支 P4 / 小程序真机（R536-1 累计）/ probe 真人口径。
