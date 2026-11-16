# R567：错题卡细分题型标签去重复组名前缀 + 小程序每日一练往期顶栏标题对齐（研究 → 论证 → 实修）

线上基线 `09d664a4`（R566 热修，PR #746 待合入）。分支 `devin/1788980694-r567-fine-type-label` 从 #746 分支开（含线上谱系）。

## 研究（一手）

### ① 小程序 `navTitleFor` 三态缺失是否为对齐缺陷 → 不是（架构不同页）

- `pages/practice/practice.ts navTitleFor(a)`：`ptitle → redo/redoset「错题重练」→ reinforce「强化练习」→ 模块 · tag3 / 子模块 / 真题 / 专项练习`，无 daily/shizheng 分支。
- 全仓核实小程序每日一练 / 时政 / 往期 / 时政复习别名（`kind=set|shizheng|szreview`、`date=`、`archive=1`）**全部走独立页 `pkgGrow/daily/daily.ts`**，不经 `practice.ts`；`navbar title="{{title}}"`，`onLoad` 只按 kind 定「每日一练 / 时政每日一练」，往期态靠 `subTitle「往期补练 · 日期」`、toast「往期每日一练 · 日期」、完成态「往期补练完成」。
- 结论：`navTitleFor` **不需要**补 daily 分支（H5 是单页多来源所以需要）；差距只在往期时顶栏与 H5「往期每日一练 / 往期时政补练」不同——小改 `begin()` 按 `past×kind` 四态置 `title`，3 行、无真机（源锁）。

### ② `09d664a4` 后 Caddy `/api/answer_log` 429 回看（`~/r545/log567.sh` / `log567b.sh`，30 天窗）

- 429 共 31 条，**全部**集中在 09-10 01:57–02:05（= R566 生产一 75 题按卷、旧 120/h 阈值窗口），UA 为 Linux X11 Chromium、无可解析 uid → 与 harness 同形态，**不能**记作自然用户；探针分类成功行 35 条；非 X11 UA 中 0 条 429，移动 UA 基本全 200。
- `09d664a4` 之后 0 条 429（任何分类）。600/h 是否被自然触达仍需分发到位后回看；旧的 500/502/503/status-0 组是既有抓取簇/发版窗形态，未在本轮重分类。

### ③ 新 375 生产截图走查（`~/r567/shots.py` → `~/r567/shots/*.png|txt`，探针 uid `test-r567-shots-375`）

- 首页 / 错题本（全部·收藏·已掌握·展开卡）/ 复习入口 / 复习 / 已答复习 / 统计 / 我的 共 10 张 + `mids.json`。
- 错题本卡头：`[题型组 brand] [细分 neutral] [来源] [错因]`。探针题为逻辑判断，细分标签显示 **「逻辑判断(加强削弱)」**，与左侧「逻辑判断」重复；复习页 / 统计 / 我的无 P0/P1（统计 0/10 是探针无本机作答，非缺陷）。

### ④ 重复前缀量化（生产库只读，`~/r567/q567b.py`，H5 `tagName` 口径：去首段「模块-」后再看是否以组名开头）

| | 组名+分隔符前缀（切） | 无分隔符前缀（不切） | 含组名非前缀 | 不同名 | 同名/无组（本就不显示） |
|---|---|---|---|---|---|
| 题库在架 | **10702**（`常识-法律-个税`→「法律」+「法律-个税」×多；`政治-党史`；`逻辑判断(加强削弱)` 等 4 种） | 2222（`政治常识`/`法律常识`/`增长率比较`/`比重反算`…） | 370 | 41153 | 54924 |
| 非测试错题 | 4 / 287 | 2 | 1 | 69 | 211 |

- 切「无分隔符前缀」会失义（「政治常识」→「常识」、「增长率比较」→「比较」）→ 规则限定「组名 + `- · / : ： ( （`」且括号包裹去尾括号；只剩分隔符时回原文。
- 小程序错题卡只显示组名（`typeName = groupName`）无细分标签 → 无此重复，不改。

## 论证结论

- 立项 **H5 错题本细分标签展示去组名前缀**（10702 行题库 ≈ 20% 细分可见题、当前真人错题 4/287；用户可感知、0 后端、不改筛选值与 `redo qtype`）。
- 立项 **小程序每日一练往期顶栏标题四态**（与 H5 同文案，3 行）。
- 不立项：`navTitleFor` 补 daily 分支（架构不同页）；Caddy 429（无自然样本）；复习页长解析（R558 已论证）；Cloudflare beacon（R566-1 等老板决定）。

## 实修

- 新 `frontend-uni/src/type-label.js fineTypeLabel(group, fine)`；`book.vue` 四处展示改走 label：卡头 `fineLabel(m)`、细分 chips、当前筛选 tag、重练入口标题；`fineType/tagName/fineTypes/qtFilter/redoTypeQuery` 值不变。
- `miniapp-native/miniprogram/pkgGrow/daily/daily.ts begin()` 置 `title`（`past × kind`）。
- 测试：`frontend-uni/tests/r567-type-label.test.js`（纯函数 + 接线源锁 + 筛选值不变源锁）、`miniapp-native/scripts/r567-daily-title.test.ts`；`r545-type-groups.test.js` 卡头源锁改 `fineLabel(m)`（模板意图变更，非放宽）。
- 本地门：H5 lint 0 / vitest 186 文件 1443（+5）/ build:h5；小程序 tsc / lint 0 / vitest 15 文件 73（+2）；diff --check 空；0 后端。

## 生产复验

### 生产一（`09d664a4` / `index-DbkPgCj4.js`，375，`~/r567/prod/report.md`，录像 `~/screencasts/r567-labels-375/`）

- 身份 / A fixture（6 条真实题库题，probe=1）/ B375 卡面「个税」「加强削弱」「政治常识」/ F HTTP / 审计 / 精确清理 PASS。
- **D375 FAIL（P1）**：POST `question_type=常识判断-法律-个税` → 后端 `norm_qtype` 落库 **`法律-个税`**（GET 回读 `type_group=法律`），H5 `tagName()` 再次无条件切首段 → 筛选 URL `qt=个税`（F5 保留错值）、重练 `GET /api/mistakes/redo?sub=法律&qtype=个税` → 200 `{items:[],skipped:0}`，toast「错题未能匹配到题库原题」。**既有缺陷**（`tagName` 的 `split('-').slice(1)` 早于 R567；R567 研究④「H5 tagName 口径」量化本身就是按这个错口径算的），本轮的 `fineTypeLabel` 只改展示、没引入也没修它；R545 起细分 chips/`qt` URL 把这个值暴露成可点筛选 + redo 参数后才成为可感知失败。1440 与其余回归按 P1 中止。
- 归因（代码）：后端 `db.norm_qtype` 只去 `_QTYPE_MOD_PREFIXES = (资料分析, 数量关系, 言语理解, 判断推理, 常识判断, 常识, 时政)` + `-`；redo 查询 `question_type=?` 精确匹配库内值。生产库只读：非测试错题含 `-` 的 `question_type` 只有 `政治-理论`×2 / `法律-民法典` / `法律-劳动`（无模块前缀残留）；题库 `图形推理-空间类` 61 行 → 任何「见 `-` 就切」都会把细分名切坏。

### 热修 `6ae243a0`（H5 + 小程序，0 后端）

- `type-label.js` 新 `qtypeName(qt)`：首段 ∈ 同一份 7 个模块名且余段非空才去前缀（与 `norm_qtype` 同口径）；`book.vue tagName()` 改走它 → 筛选值 / `qt` URL / `&qtype=` = 库内 `question_type`；展示仍 `fineTypeLabel(type_group, fine)`。小程序 `book.ts tagName` 同口径（避免 H5/小程序分叉）。
- 测试：`r567-type-label.test.js` 补 `qtypeName` 正反例 + H5/小程序接线源锁；`r545-type-groups.test.js`、`book-r516-tagname-answer-format.test.js` 两个 `new Function` 动态 harness 注入 `qtypeName`；R516 用例 `政治-理论 → 理论` 改为 `常识判断-政治-理论 → 政治-理论` / `政治-理论` 原样（旧断言锁的正是本次坐实的错口径）。
- 本地门：H5 vitest 186 文件 1446 / eslint 0 / build:h5（`index-CLSTMI1s.js` / `pages-book-book.DAWcePg7.js`）；小程序 tsc / lint 0 / vitest 73；diff --check 空。
- 发版：后端无改动且宿主 compose 被同机 `docker builder prune` 挤住（见 handoff），**只手动跑 `deploy_h5.sh` 4c 段**（同命令：新账号 `kaogong-h5-zalize` `wrangler pages deploy`），bundle / 各 Accept-Encoding 变体 JS MIME / 6 项回归 200 手工核过；health 仍 `09d664a4`。

### 生产二（`09d664a4` / `index-CLSTMI1s.js`，375+1440，`~/r567/prod/report-2.md`，录像 `~/screencasts/r567-fix-375/`、`~/screencasts/r567-fix-1440/`）

- 身份：HTML / 实际执行 Script / 两目标资产 SHA256 = 本地 dist。
- A：新 UID 6 条真实题库 fixture（先 GET 回读库内值再写）。B/C 375+1440：「法律」+「个税」展示，URL **`qt=法律-个税`**，物理 F5 同 raw 值且只剩目标卡；逻辑 `逻辑判断(加强削弱)` / 政治 `政治常识` 同样 URL = 库内原值、展示按 R567 设计。
- D 375+1440：重练请求 `sub=法律&qtype=法律-个税` → 200 items = [4178]，进 practice 1/1、顶栏「错题重练」（R566 回归）；375 另两组 redo 分别回 571 / 139 正常启动。
- 回归：收藏 tab / 收藏后 F5 / 更多操作层标题为 raw「法律-个税 · 更多操作」（**该处未做简称，登记 R567-1**）/ 删除确认取消 / 内置复习 1/6 进出 PASS。
- F：六类资源 200、CSP/HSTS 在、JS MIME 正确 + immutable。
- 审计：1029 请求 = 899 HTTPS 200 + 114 data URL + 16 tab 图标自然取消；127 API 全 200 probe=1；console error / uni warning 0；应用来源 runtime/rejection 0（harness 字符串 `wait_for_function` 撞 CSP 各 1，10 条 SW warning = Playwright 阻止注册）。
- 清理：精确清本人 11 行（mistakes 6 / question_favs 1 / growth_events 3 / practice_progress 1），41 表本人残留 0，前缀 `test-r567-%` 11→22→11（他 UID 旧 11 行保留）；五类 hash / taxonomy / 卷 / 共享 42 行不变。
- **UNTESTED**：`#/pages/review/review` 独立路由新 Document 直达重定向首页（我的测试指令写了一个不存在的独立复习页，非缺陷，改测真实入口）；小程序无真机；真实 SW/offline、跨设备、其它浏览器。

## UNTESTED / 登记

- **R567-1**：更多操作层标题 `tagName(m) · 更多操作` 显示库内 raw 值「法律-个税」，与卡头/chip 的简称不一致（低优，是否走 `fineLabel` 下轮决定）。
- 教训：任何「见 `-` 就切」的题型处理都是错口径——前端归一化必须与后端 `norm_qtype` 共用同一份模块名单；复验必须把「显示文案 / 库内 `question_type` / URL `qt` / redo `qtype`」四个值分开断言，且 redo 只认 items 非空不认 HTTP 200。
- 小程序往期标题只有源锁，无真机（R536-1 累计）。
- 全角括号 / `·` / `/` 分隔的组名前缀在生产题库无样本，仅单测。
- 「政治常识」类无分隔符前缀保持原样（有意）。
- R566-1 Cloudflare beacon 撞 CSP 继续等老板决定。
