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

（发版后回填）

## UNTESTED / 登记

- 小程序往期标题只有源锁，无真机（R536-1 累计）。
- 全角括号 / `·` / `/` 分隔的组名前缀在生产题库无样本，仅单测。
- 「政治常识」类无分隔符前缀保持原样（有意）。
- R566-1 Cloudflare beacon 撞 CSP 继续等老板决定。
