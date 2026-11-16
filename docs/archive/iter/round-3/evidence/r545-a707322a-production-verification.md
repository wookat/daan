# R545 生产黑盒复验 — a707322a

在生产站完成了隔离匿名用户、375×812 / 1440×900 真实 UI、同源 API 请求及容器只读 DB 验证，并完成清理。题型组主流程通过；发现一个 **P2 既有返回导航 URL 同步问题**，别名 submodule 因生产没有可用样本未验证，不能称为全项通过。

## 1. 目标、口径与边界

- 站点：<https://kaogong.zalize.com>。Session：<https://app.devin.ai/sessions/0453963bab7543f691c1166050ec9533>。
- **42df6d14 首发 → a707322a 合并 main 后再发版，R545 代码一致**。测试设置过程中生产更新，经 lead 确认将目标改为 a707322a；相关 `db.py / taxonomy.py / study_api.py / book.vue / book-url.js` 两 rev 无差异。没有混用旧版 UI 证据。
- 实际 `/api/health`：`{"ok":true,"rev":"a707322a"}`；HTML 与 runtime 均为 `index-Dxu3v3c0.js`。开始及结束均确认，无 SW 旧壳，未执行 SW 修复。
- UID：`test-r545-verify-0d1e368ad7`。隔离 Chrome context；写入前回读 `localStorage.anonUid`；174 个 API 请求全部有 `X-Kg-Probe: 1`。
- lead 更正验收口径：生产题的 `submodule` 本就是规范组名，分散来源为不同 `question_type`；`qtype` 使用 **mistakes 存储的去前缀值**；到期接口为 **`/api/review`**，不是 `/api/review/due`。这些不计产品 FAIL。
- 无产品源码修改、无本地产品服务、无题库写入、无付费 AI 请求。通过允许的公开 `POST /api/mistakes` 准备 fixture；redo 与 review 只验证选题/加载，不作答，以免改变 3/2 题数量。
- 小程序真机、付费 AI、OCR、PDF、完整读屏、全题库、redo 判分/复习排程不在本轮验证范围。未将本次加载验证描述成答题完成验证。

## 2. 先列问题和未覆盖

### FAIL / P2 既有：重练返回后 URL 与可见筛选不同步

**步骤（1440）：**
1. 从无 query 的 `/#/pages/book/book` 加载错题本。
2. 点「筛选与排序」→「排列组合与概率 ×3」→「概率问题 ×2」→「完成」。
3. 此时 UI 两张卡，URL 正确含 `kp=排列组合与概率&qt=概率问题`。
4. 点「错题重练」进入 1/2，点左上页内返回。
5. UI 仍显示两张卡和组合筛选标签，但 URL 退回无 query 的 `/#/pages/book/book`。
6. 刷新后两级筛选全部丢失，恢复五张卡。

**旧筛选对照（375）：** 同样从无 query 页面仅点「数量关系」模块，URL 为 `?mod=shuliang`、四张卡；重练 1/4 后返回，`mod` 同样消失，刷新变全部五张卡。因此按 lead 指定判定口径记录为 **既有路由同步问题，非 qt 特有的 R545 回归**。本次未回滚生产到 R544，结论依据旧模块路径对照，不声称运行了旧版本。

影响：用户重练返回后复制地址或刷新，不能保留当前筛选；若首次进入的旧路由有其他 query，也可能回退到旧参数。建议下一轮处理。**直接选择后立即刷新、或有效深链直达的恢复本身通过**，与上述返回路径分开计。

| 1440：返回后仍是概率两题（URL 已丢 kp/qt） | 375：旧模块返回后仍选四题（URL 已丢 mod） |
|---|---|
| ![1440返回后两题，地址证据见return-stale-1440.json](https://app.devin.ai/attachments/9169e840-d120-44ff-86b4-ba5d37092141/return-stale-1440.png) | ![375旧模块对照，地址证据见module-return-stale-375.json](https://app.devin.ai/attachments/b3aedd68-16f6-4d23-a407-a18ed5e4fba1/module-return-stale-375.png) |

| 1440：随后刷新恢复全部五题（错误结果） | 375：随后刷新模块亦丢失（错误结果） |
|---|---|
| ![1440刷新丢筛选](https://app.devin.ai/attachments/46ecaa36-2827-4d4a-97ad-f5f5680b97b5/return-reload-lost-1440.png) | ![375刷新丢模块](https://app.devin.ai/attachments/de28dc7f-d4ab-403a-aff7-9d5441426149/module-return-reload-375.png) |

URL、UID、视口及请求证据：`return-before-1440.json`、`return-stale-1440.json`、`return-reload-lost-1440.json`；对照为 `module-return-before-375.json`、`module-return-stale-375.json`、`module-return-reload-375.json`，均在 `/home/ubuntu/r545-verify/`。

### UNTESTED：别名 submodule 归一

只读全库查询：`submodule='排列组合'` **0 条**；`submodule='概率问题'` **1 条且 disabled=1**（qid 536440）；规范 `排列组合与概率` 6204 条。经 lead 确认，改选规范 submodule 下真实 1+2 细题型，仍覆盖生产实际分散场景。没有为造别名样本修改题库；**别名分支不能由本轮生产黑盒证明**。

### 其他观察

直接输入只有 `qt`、没有 `kp` 的 URL 时，UI 忽略 qt、显示全部五题；原始孤立 qt 文本仍留在地址栏，下一次 UI 筛选/切 tab 后规范化。本轮验收为“qt 仅随 kp 参与筛选及由 UI 序列化”，这一行为不判 FAIL，但保留证据 `orphan-qt-1440.json`。

## 3. A — 数据准备与只读 DB

只读连接固定为 `sqlite3.connect("file:/data/data.db?mode=ro", uri=True)`，SSH 到生产容器 `deploy-kaogong-1`，未经 DB 造题/改错题。

| mistake_id | question_id | questions.submodule | questions.question_type → mistakes.question_type | API type_group |
|---|---:|---|---|---|
| 3284 | 63 | 排列组合与概率 | 数量关系-排列组合 → 排列组合 | 排列组合与概率 |
| 3285 | 64 | 排列组合与概率 | 数量关系-概率问题 → 概率问题 | 排列组合与概率 |
| 3286 | 381 | 排列组合与概率 | 数量关系-概率问题 → 概率问题 | 排列组合与概率 |
| 3287 | 8223 | 计算问题 | 数量关系-计算问题 → 计算问题 | 计算问题 |
| 3288 | null | 无关联 | 手录验证 → 手录验证 | null |

- **PASS**：四条关联题 module=`shuliang`，手录 module=`yanyu`；前3题 disabled=0，另外一题只读筛选为可用题。
- **PASS**：5 次公开 POST 均 HTTP 200，返回 3284–3288；`mastered=0`、`review_count=0`、`next_review=null`，均是本轮 UID 待掌握错题。
- **PASS**：列表及到期数据均5条，每条包含 `type_group`；三条目标题统一组名，手录 null。
- **PASS**：手录卡使用「手录验证」主标签，未被归入排列组合与概率；无 finetag。

请求体样例（原始 question_type 是 fixture 输入，不是 redo 的 qtype）：

```json
{"uid":"test-r545-verify-0d1e368ad7","question_id":64,"module":"shuliang","question_type":"数量关系-概率问题","question_text":"袋中有4个红球和3个白球，除颜色外完全相同。从中一次随机取出2个球，取出的2个球都是红球的概率是多少？","options":{"A":"1/7","B":"2/7","C":"3/7","D":"4/7"},"correct_answer":"B","user_answer":"A"}
```

证据：`/home/ubuntu/r545/samples545.out.txt`（规范题库样本及 alias 缺样本）、`baseline.txt`、`seed.json`、`check.json`、`final-db.txt`。最终 DB 中本 UID `answer_log/review_log/practice_results` 均空，符合本轮只加载不作答的范围。

## 4. B — 接口逐项结果

下表 query 均省略相同 `uid=test-r545-verify-0d1e368ad7`，展示解码后值；证据文件保留完整编码 URL/状态/响应。

| 检查 | 结果 | 实际响应 |
|---|---|---|
| `GET /api/mistakes` 字段和分组 | PASS | 5条全含 type_group；3条同组，手录null |
| redo `sub=排列组合与概率` | PASS | HTTP200，qid `[63,64,381]`，skipped=0 |
| redo `sub=排列组合与概率&qtype=概率问题` | PASS | HTTP200，qid `[64,381]` |
| redo `sub=排列组合与概率&module=shuliang` | PASS | HTTP200，qid `[63,64,381]` |
| redo `sub=排列组合与概率&qtype=概率问题&module=shuliang` | PASS | HTTP200，qid `[64,381]` |
| redo `sub=排列组合与概率&module=yanyu` | PASS | HTTP200，items=[] |
| redo `sub=不存在的组` | PASS | HTTP200，items=[] |
| redo `sub=` 空串 | PASS | HTTP400，`{"detail":"无效的题型组"}` |
| redo `sub=  ` 两空格（附加边界） | PASS | 同上 |
| redo `sub=` 41个“字” | PASS | 同上 |
| `GET /api/review` | PASS | HTTP200，total=5，所有条目含type_group，3条同组/手录null |
| alias submodule 分支 | UNTESTED | 无可用生产样本，不伪造覆盖 |

关键 UI 发起请求：

```text
/api/mistakes/redo?limit=10&uid=<uid>&sub=排列组合与概率
  -> [63,64,381]（375 / 1440 两遍）
/api/mistakes/redo?limit=10&uid=<uid>&sub=排列组合与概率&qtype=概率问题
  -> [64,381]（375 / 1440 两遍）
/api/mistakes/redo?limit=10&uid=<uid>&sub=排列组合与概率&module=shuliang
  -> [63,64,381]（1440）
/api/mistakes/redo?limit=10&uid=<uid>&module=shuliang
  -> [63,64,381,8223]（375，旧筛选对照）
```

原始证据：`request-evidence.json` 汇总 `__exb` 及快照；`check.json` / `final.json` 为显式 API 探针。`redo-group-{375,1440}.json`、`redo-fine-{375,1440}.json`、`redo-module-1440.json` 为 UI 当时快照。

## 5. C — H5 双视口逐项结果

| 检查 | 375×812 | 1440×900 | 实际可见结果 |
|---|---|---|---|
| 主题型chip聚合 | PASS | PASS | 仅一个「排列组合与概率 ×3」，没有把两个细题型列为平级主组 |
| 选择组后的二级行 | PASS | PASS | 「排列组合与概率 · 细分」，概率问题×2、排列组合×1 |
| 主tag与finetag | PASS | PASS | 蓝色组名；不同细型为neutral小tag；finetag computed rgb(107,114,128)，背景rgb(242,243,247) |
| 概率细分列表与当前筛选标签 | PASS | PASS | 两张概率题卡；「排列组合与概率 · 概率问题」 |
| 点击细分再次取消 | PASS | PASS | qt移除，保留kp，回三张组内卡；可再次选择 |
| 组redo | PASS | PASS | 进入1/3，query含sub，排除计算题和手录 |
| 细分redo | PASS | PASS | 进入1/2，query含sub及qtype=概率问题 |
| 重练提示文案 | PASS | PASS | 组提示“含组内各细分题型”；细型提示“只重练当前细分题型” |
| UI URL包含kp+qt | PASS | PASS | 快照中两个参数均存在 |
| 直接刷新恢复两级筛选 | PASS | PASS | 原两题、选中状态和组合标签恢复 |
| 有效深链恢复 | PASS | PASS | 有效kp/qt加载后恢复；1440通过同一有效地址刷新重建页面 |
| 改模块移除qt | PASS | PASS | 375改言语只见手录；1440改数量见四条，均无qt |
| 清除组移除qt | PASS | PASS | 无kp/qt，恢复五条；1440保留独立sort=type |
| 手录卡fallback | PASS | PASS | “手录验证”，不并入目标组，无finetag |
| 模块折叠层 | — | PASS | 数量关系4，规范组3、计算问题1；细题型不作为组平级 |
| 外组qt丢弃（附加） | 未重复 | PASS | kp=目标组、qt=计算问题，加载后qt丢弃、保留组3条 |
| 仅qt无kp（附加） | 未重复 | PASS | 不生效、五条；地址原文保留，见上文观察 |
| redo返回后刷新保留筛选（附加/旧路径对照） | FAIL（旧模块） | FAIL（两级） | P2既有问题，详见§2 |

### 题型组与细分chips

| 375×812 | 1440×900 |
|---|---|
| ![375聚合组与细分chips](https://app.devin.ai/attachments/ba313452-08f4-46c8-9a6a-db82042c6c3e/finechips-375.png) | ![1440聚合组与细分chips](https://app.devin.ai/attachments/b82e1fbb-0a12-461f-b17f-2c55cf0984c1/finechips-1440.png) |

### 选中概率细分：两张卡及主/细分标签

| 375×812 | 1440×900 |
|---|---|
| ![375概率两题](https://app.devin.ai/attachments/fdc2ece2-d5f6-47bf-ae21-2690a290a602/fine-selected-375.png) | ![1440概率两题](https://app.devin.ai/attachments/f7e3f382-ee38-4b02-88ec-c9704d3aa10c/fine-selected-1440.png) |

### 组redo：三题

| 375×812 | 1440×900 |
|---|---|
| ![375组重练1/3](https://app.devin.ai/attachments/463210e9-da92-4c41-a859-b64fbb2ef2e3/redo-group-375.png) | ![1440组重练1/3](https://app.devin.ai/attachments/0c3a7814-3e4e-415b-9fc4-1e90087f5e08/redo-group-1440.png) |

### 细分redo：两题

| 375×812 | 1440×900 |
|---|---|
| ![375细分重练1/2](https://app.devin.ai/attachments/d5da9634-ccb9-4f51-aa4e-cc3984fd3f18/redo-fine-375.png) | ![1440细分重练1/2](https://app.devin.ai/attachments/b25fb06c-e95f-4596-8aed-f9e24dbfa1bc/redo-fine-1440.png) |

### 手录独立fallback

| 375×812 | 1440×900 |
|---|---|
| ![375手录卡](https://app.devin.ai/attachments/b436008a-1512-4589-9487-c3ba7d11b437/manual-375.png) | ![1440手录卡](https://app.devin.ai/attachments/dece0445-408b-4896-bc83-ffa58b05f549/manual-1440.png) |

## 6. D/E — Regression、网络与通用取证

- **PASS**：待掌握/已掌握/收藏 tab 双视口切换，分别显示待掌握5、已掌握空态、收藏空态。
- **PASS**：模块筛选数量关系4、言语1；桌面排序「按题型」生效、URL `sort=type`，无运行时异常。未额外重复移动端排序操作。
- **PASS**：今日复习双视口进入1/5；实际 `/api/review` 正常。未提交答案/改变排程。
- **PASS**：首页/统计页双视口正常加载；统计0次作答符合fixture只造错题而未作答的事实。
- **PASS**：375文档/页面宽度375，无横向溢出；截图全部校验尺寸，共17张375×812、20张1440×900，无误标1600宽图片。
- **PASS**：桌面真实Tab到「选择考试」，蓝色2px focus outline可见，computed `rgb(46,91,255) solid 2px`。仅粗查键盘焦点，不等于完整无障碍审计。
- **PASS（有预期负例）**：1271个HTTP响应：200×1223、304×45（静态tab图标缓存校验）、400×3（主动空串/空白/超长sub边界），其他HTTP错误0。
- **PASS**：应用 `console.error` 0、runtime exception 0、所有保存快照 `__cerr/__pexc` 均空。浏览器网络错误日志3条，均对应上述主动400；不能把它们隐去后声称所有浏览器error日志为0。
- **已记录取消加载**：22条 `ERR_ABORTED, canceled=true`：18条tab图标，4条XHR（mastery/map 3、review/cur 1），发生在直接跳转/紧接刷新阶段。后续加载与页面恢复正常；独立于HTTP失败统计，无未取消的loadingFailed。
- **PASS**：174个API请求探针header完整；请求路径中无付费AI/OCR/讲解/ask调用。没有点击AI解析、AI错题分析或OCR。`explain_cache`始终82行，最大created_at为1788730850.6344447，未删除/写入该表。

| Regression：375复习1/5 | Regression：1440复习1/5 |
|---|---|
| ![375复习加载](https://app.devin.ai/attachments/4804f6ff-19de-4664-a8ef-644700918bd8/review-375.png) | ![1440复习加载](https://app.devin.ai/attachments/d3520914-eab3-45fb-a9f5-613d9d497d87/review-1440.png) |

桌面焦点证据：[选择考试的蓝色焦点截图](https://app.devin.ai/attachments/192cb26d-155e-4676-b9c3-78f70e9ff149/focus-home-1440.png)。

证据：`network-audit.json`、`events.jsonl`、`request-evidence.json`、`screenshot-audit.json`、`final.json`。

## 7. F — 清理

**PASS**：先关闭/销毁隔离 browser context，再清理。枚举全部含 `uid`、`user_id`、`*_uid` 列的 **41张表**，只按本轮精确UID删除，未宽泛删除他人test记录；随后整个 `test-r545-%` 前缀亦确认零残留。

```text
UID test-r545-verify-0d1e368ad7
BEFORE {"mistakes": 5, "growth_events": 5}
PREFIX_AUDIT {"mistakes": 5, "growth_events": 5}
EXPLAIN_CACHE {"n": 82, "latest": 1788730850.6344447}
LEFTOVER 0 {}
PREFIX_LEFTOVER 0
```

另用独立**只读连接**复查：

```text
BEFORE {}
PREFIX_AUDIT {}
EXPLAIN_CACHE {"n": 82, "latest": 1788730850.6344447}
mistakes []
answer_log []
review_log []
practice_results []
```

删除合计10行：5错题、5探针埋点。证据：
`/home/ubuntu/r545-verify/clean.txt`、
`/home/ubuntu/r545-verify/readonly-after-clean.txt`。

## 8. 交付物及设置偏差

- 报告：`/home/ubuntu/r545-verify/R545-a707322a-production-verification.md`
- 连续录屏：`/home/ubuntu/screencasts/r545-a707322a-production/r545-a707322a-production-edited.mp4`
- 截图：`/home/ubuntu/r545-verify/*.png`；本文已嵌入核心17张的上传URL，完整37张名称及真实尺寸见 `screenshot-audit.json`。
- 请求：`/home/ubuntu/r545-verify/request-evidence.json`；完整网络事件 `events.jsonl`；汇总 `network-audit.json`。
- DB：`/home/ubuntu/r545/samples545.out.txt`、`/home/ubuntu/r545-verify/baseline.txt`、`final-db.txt`、`clean.txt`、`readonly-after-clean.txt`。
- fixture请求：`seed.json`；API断言：`check.json`、`final.json`；各UI快照的URL/请求可由 `request-evidence.json` 中 snapshots 查到。

设置中发生并已处理的偏差：
1. 原始alias选样不存在，经lead更正使用真实规范组题；alias分支仍UNTESTED。
2. 生产设置中再发版，经lead批准更新目标，不把新bundle当旧rev证据。
3. 辅助Python import出现一次循环导入，在任何fixture POST之前修正为runpy加载；未安装新依赖。
4. 原生地址栏输入中文URL未正确保留参数，改用percent-encoded URL后重复有效深链测试；不算产品URL解析缺陷。
5. GUI工具附带DOM停留在另一个new-tab target，因此没有用该DOM断言产品；实际像素录制及CDP取证均锁定本轮isolated targetId。

## 9. SKILL追加建议（文本，未修改仓库文件）

建议并入现有 `.agents/skills/testing-kaogong-assistant/SKILL.md`：

1. **生产taxonomy选样**：先查questions.submodule/question_type/disabled，不假设submodule保留别名；生产可能已统一submodule，但question_type仍存在细分。无可用alias样本应列UNTESTED，不能修改生产题库造覆盖。
2. **三个名字分开取证**：questions.question_type原值、mistakes.question_type规范化值、type_group规范组名；redo qtype用mistakes存储值，sub用组名。保存UI真实请求，分别检查sub-only、sub+qtype、sub+module及三者组合。
3. **URL恢复分两条路径**：直接刷新/深链与“重练→返回→刷新”不能互相替代。额外用旧module筛选作对照，区分qt专属问题与通用路由同步问题。
4. **生产版本锁定**：health、index HTML、runtime bundle三证一致；若设置中再发版，暂停并取得目标更新确认，报告写明版本链及相关文件是否一致。
5. **真实细分fixture**：本轮可用样本qid63/64/381/8223仅作例子，未来应重新只读选择可用题。手录不传question_id，用不同模块便于模块过滤的对照。
6. **同源API负例**：API负例产生的浏览器network error与应用console/runtime error单独统计；304与canceled不能算作应用HTTP失败或悄悄省略。
7. **辅助工具**：CDP模块脚本不要按同名cdp模块直接互相import；使用已有venv websocket-client，原生输入深链建议percent-encoded中文，并在最终快照确认URL。

on-disk SKILL.md建议文件：**none**（按用户要求只列追加文本，未直接改技能文件）。

## 10. Blueprint、PR与用户待办

- **Blueprint建议**：已再次读取，仓库root无blueprint且当前无更新权限。建议记录现有 `/home/ubuntu/venv-kg/bin/python` 的 websocket-client、系统Python paramiko/Pillow、CDP29229、`wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz`、持久viewport holder与精确targetId、SSH变量 `TICKETS_VPS_SSH_HOST/USER/CREDENTIAL`、只读DB及关闭context后精确UID清理。生产访问与清理应作为按需测试知识，不应放进自动maintenance。本轮未安装产品依赖/工具，未启动本地产品服务，只启动了临时CDP监听与viewport holder。
- **建议PR评论内容**：none，按lead既有指示由lead处理，不推断PR生命周期。
- **仍需用户提供**：none。别名样本缺失限制已披露；P2按lead口径留下一轮处理，无需为本次结案改动生产。
