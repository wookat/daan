# R398：SOP-10 四维审计（R386 后第 12 轮，对标粉笔错题本）+ 错题本 375 弹层全部让出 TabBar + AI 分析失败态可重试

取证窗口：2026-09-05 10:00Z ~ 2026-09-06 02:00Z。生产库证据全部来自 `docker exec -i deploy-kaogong-1 python3 -` 只读连接（`file:/data/data.db?mode=ro`），剔除 `uid like 'test-%' / 'probe%'`；UI 证据引用 R396/R396b 走查实录（`/tmp/r396_375_*.png`，已随 PR #615 评论上传）。粉笔侧证据说明见 §0。

## 0. 竞品取证边界（如实说明）

- **粉笔错题本本轮没有一手证据**：需要粉笔账号登录 App/小程序才能进入错题本次级屏，本会话无账号；公开网页能搜到的是第三方经验帖/内容站（0539edu、xiaozhiwenda、yidianwenda 等），**只能当二手材料**。二手材料里跨多篇一致的描述：错题按科目/题型/错因/来源筛选；错题重做、答对后移出（可在设置调整）；手动「已掌握/删除」，记录保留；复习提醒；批量重做/导出 PDF；「顽固错题」（多次错）突出。
- 因此本轮**不以「粉笔有 X」为由新增任何功能**。审计问题改为可一手取证的两问：① 我们已有的对应功能在 375（手机主视口）上**能不能用**；② 生产真人数据里这些功能**有没有被用**、卡在哪一步。

## 1. 生产真人数据（一手，09-06 02:00Z）

| 项 | 值 |
|---|---|
| `mistakes` | 221 行 / 59 uid；`mastered=1` **0 行**；`error_reason` 非空 6 行；`times>1` 7 行（2 次 6、3 次 1） |
| `review_streak` 分布 | 0：204 / 1：11 / 2：6 |
| `review_count` 分布 | 0：201 / 1：12 / 2：7 / 3：1 |
| `next_review` | 已到期 24 / NULL（从未进入复习）197 / 未来 0 |
| `review_log` | 30 行 / 5 uid（24 对）；按 uid×日：`umsn3fw…` 08-10 2 题 0 对、08-13 3 题 0 对；`u26` 08-29 18 题 18 对；`umtf09…` 08-30 3 题 3 对；`u32` 09-02 3 题 2 对 |
| 有错题但**从未复习**的 uid | 54 / 59 |
| 未掌握错题里同题**事后答对过**（任意场次 `answer_log`） | 21 行；答对 ≥2 次 6 行 |
| 待掌握 ≥3 题（AI 分析入口出现的门槛）的 uid | 20 |
| `reinforce_log` / `question_notes` / `question_favorites` / `favorite_folders` | 2 / 5 / 8 / 1 |
| `paper_exports`（无 uid 列，不能分真人） | 38 |
| `exam_attempts` | 28 / 20 uid，已交卷 10 |
| 近 60 天真人口径 `growth_events` | boot 231(230 uid)、heatmap_view 72、slow_load 58、share_open 29、pk_result_open 22、team_join_open 16、task_card_click 11、**review_entry_click 10 (7 uid)**、share_copy 7、daily_open 6、share_answer 4、review_done_celebrate 3、register 1 … |
| 近 30 天真人口径 `answer_log` | 303 条 / 48 uid（探针另 50 条 / 4 uid）；最大会话 u26 49 题错 19、u32 44 错 15、u17 36 错 26 |

事实（不是推论）：
1. 错题本的「进入 → 复习」漏斗在真人数据里是 59 → 5 个 uid（8%）；`review_entry_click` 60 天 10 次 / 7 uid。
2. 没有任何一道错题走到「已掌握」——手动标记 0，SRS 阶梯（1/3/7/15/30 天、streak>5）在站龄 <30 天内数学上也到不了。
3. 21 道未掌握错题用户已在别的场次答对（其中 6 道答对 ≥2 次），仍显示「待掌握」；其中 R371（09-01）之前的作答没有推进 SRS，之后的有（streak>0 的 17 行）。
4. 错因标注 6/221（2.7%），与 R386 时的 6/243 完全没涨；这是「用户不标」不是「没有功能」（卡片展开有「错因自评」四选一）。

## 2. 四维审计表

| 维度 | 一手证据 | 结论 / 差距 |
|---|---|---|
| 实体操作台 | 管理台看板已有真人口径（R374–R393）；本轮新增的复习漏斗/掌握率数字**看板没有**，只能 SQL 取 | 差距 P2：看板缺「错题本漏斗」（有错题 uid → 复习过 uid → 已掌握题数）。本轮不做，先把漏斗第一段（375 能不能用）修通再看数据是否变化 |
| 核心功能 | **R396 走查实录（375）**：① 复习完成后「强化卡」sheet 的「下次再说」rect y 767–792 被 tabbar（fixed 762–812，z-index 998 > mask 99）完全盖住，`elementFromPoint`=tabbar IMG，sheet 不可滚动——唯一出路是点遮罩或点「强化 5 道新题」（P1-4）；② AI 分析失败文案在 sheet 底部被 tabbar 盖住，用户只看到空的「AI 错题分析 ×」sheet（P1-3）；③ 筛选 sheet 底部 50px 恒被盖住，「完成/导出 PDF」要滚到底才露出（P2-8）。代码核实：`book.vue` 9 个 `.mask` 弹层（celebrate/reinforce/AI/手动录入/扫描结果/键盘帮助/筛选/报告）**全部**未让位 TabBar，只有 PDF 导出用了 `export-confirm above-tabbar`（home.vue 同类 sheet 用 `padding-bottom: 146rpx` 让位） | **命中（本轮修）**：错题本是 tab 页，所有次级弹层在手机上底边都在 TabBar 之下。这直接对应 §1 事实 1（复习完成后的强化/庆祝流程在手机上不可用）——先修再看漏斗 |
| 核心功能（失败态） | `aiAnalysis()` 把失败文案写进 `aiHtml`，而入口 `if (this.aiHtml) return` → **失败一次后本页永远不再请求**，无重试按钮（R396 P1-3 原话「无重试按钮」）；R397 后端已改为空正文 502 + 友好文案，前端仍是这条死路 | **命中（本轮修）**：失败不缓存、显示后端友好文案 + 「重试」 |
| 落地页/首页 UI | Google `site:` 2 页、`/tiku/q/*` 抓取 26 次/14 天（R394）；本轮未新增证据 | 无变化，不动 |
| 系统架构 | `baa46a6` 容器 healthy / 0 重启；`[llm] rescue` 回落 warning 自 R397c 上线后日志 0 条（无人触发 AI 分析） | 无新 P0 |

## 3. 本轮改动（`frontend-uni/src/pages/book/book.vue`，bundle 变）

1. H5 窄屏 `.mask` 让出 TabBar，与 `export-confirm.above-tabbar` 同一约定，9 个弹层一次覆盖：
   ```css
   /* #ifdef H5 */
   @media (max-width: 767px) { .mask { bottom: calc(50px + env(safe-area-inset-bottom)); } }
   /* #endif */
   ```
   ≥768px 桌面 tabbar 已是左侧栏（App.vue），不受影响；小程序端 `#ifdef H5` 不编译。
2. AI 分析失败态：`aiErr` 独立于 `aiHtml`，失败显示「分析失败：{后端 detail}」+「重试」（`aiAnalysis(true)`）；成功但正文为空同样按失败处理（后端 R397 已 502，这里是前端兜底）；入口 `@click="aiAnalysis(false)"` 显式传参（原 `@click="aiAnalysis"` 会把 event 当 retry）。
3. 源文件锁 `tests/book-sheet-tabbar.test.js`（3 例）。

不做（及理由）：
- **不改 SRS 掌握阈值 / 不加「答对即移出」**：粉笔侧只有二手描述；我方 21 道「事后答对仍待掌握」是事实，但「答对一次就算掌握」与 R371 建立的 SRS 契约相反，需要设计论证 + 更长站龄数据，列为 R399+ 候选（先出方案再写码）。
- **不加错因聚合/错因引导**：6/221 标注，功能在、没人用；先修手机可用性再看是否变化。
- **19 套候选真题卷不建**：本轮无新证据。

## 4. 本地门禁

- vitest 559（+3）/ eslint / build:h5：见 PR 描述。
- 375/1440 生产复验：testing agent（强化卡「下次再说」可点、AI 失败态与重试、筛选 sheet 底行可见、PDF/手动录入/键盘帮助 sheet 回归、1440 无劣化）。

## 5. 未验证 / 边界

- 粉笔错题本次级屏无一手截图（无账号），本轮所有「粉笔有 X」均为二手，未据此实现任何功能。
- AI 失败态在生产只能靠真实 502 出现，无法人为触发；复验若失败态未出现，只能验证成功路径 + 单测。
- 小程序端 `.mask` 不变（`#ifdef H5`），小程序 tabbar 为原生层，不存在本问题（未实机验证）。
