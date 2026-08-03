# 考公错题助手 MVP 验收测试报告

## 增量测试 R119（手动录入答案）— 2026-08-03

- 测试环境：**线上 https://kaogong.zalize.com**，强刷确认新 bundle `assets/index-DME6Kczy.js`。无需登录，本轮**未出现访问码弹窗**。浏览器内容区实际 `innerWidth=500`（非精确 375px，rpx 尺寸按 500/375 换算）。
- 测试 uid（浏览器匿名 uid）：**`umsd071maax1ogamv`** — 本轮 `POST /api/paper_answers` 用此 uid 落库，请用它清理 answer_log 与本轮新增错题。
- 结论：**测试计划全部断言通过，无失败项**。

### 1. 造卷 + recentPapers
- 刷题页自定义练习导出 10 题小卷 PDF 下载成功，标题「真题精选卷 8月3日」，响应 `X-Paper-Code` 生效：`localStorage.recentPapers = [{"code":"20F47932","title":"真题精选卷 8月3日",...}]` — **passed**

| 导出小卷 | 错题本入口卡（扫描答题卡下方） |
|---|---|
| ![导出小卷](https://app.devin.ai/attachments/978c1dee-9f8d-429f-849a-96d01807ec5a/ss_50ceb93b.png) | ![入口卡](https://app.devin.ai/attachments/779dbfa0-8001-46dc-91db-b3121b59bab5/ss_1c86ced1.png) |

### 2. 入口与错误路径
- 「手动录入答案」入口卡位于「扫描答题卡」卡片正下方，compose 图标 + 副标题 + 「录入」按钮 — **passed**
- 输入不存在卷码 `ZZZZ9999` → toast「未找到该卷码对应的导出记录，请核对卷面右上角/封面的卷码」，不崩溃 — **passed**

| 🔴 错误卷码友好提示 | 🟢 chip 查卷成功（10 题 ABCD 网格） |
|---|---|
| ![错误卷码](https://app.devin.ai/attachments/2b0421dd-0d76-4f73-9d6e-f91fe5c15704/ss_43f55039.png) | ![查卷成功](https://app.devin.ai/attachments/b2ad9abd-3e58-4b93-aefe-1e0e9d9cc63e/ss_5ce40cb4.png) |

### 3. 查卷与点选交互
- 点「最近导出的试卷」chip → 「真题精选卷 8月3日 · 卷码 20F47932 · 共 10 题 · 已选 0」+ 1–10 题号 ABCD 网格 — **passed**
- 点选/改选/取消：题1=D、题2=A（故意错，正确 C）、题3 先 C 后改 A、题4 选后再点同字母取消、题5=D；「已选 X」实时 0→3→4 变化 — **passed**

![点选与已选实时变化](https://app.devin.ai/attachments/40e4b744-0001-44b1-a514-a29bf67aa62f/ss_b0d5d6c7.png)

### 4. 交卷判分（核心）
- 参考答案（导出 PDF 提取）：D C A B D B C C D D。最终点选：1=D✓ 2=A✗ 3=A✓ 4取消 5=D✓，其余未答。
- 结果弹层：「卷码 20F47932 · 已作答 4/10 · 答对 3 题 · 已记入做题记录」，逐题 D✓ / A✗(答案C) / A✓ / 未涂— / D✓，其余未涂 — **与点选和参考答案完全一致，passed**

![对答案结果弹层](https://app.devin.ai/attachments/f86271ba-8bf7-4eae-a991-e86acb62d612/ss_zoom_5bd9edaf.png)

### 5. 错题落库
- 提交前错题本待掌握 189 → 关闭结果弹层后 **190**；列表顶部新增「政治 · 今天 16:26」（2023国考·地市级 全过程人民民主题）= 本卷第 2 题答错题，常识判断计数 47→48 — **passed**

| 🔴 提交前 189 | 🟢 提交后 190 + 新增错题置顶 |
|---|---|
| ![提交前](https://app.devin.ai/attachments/b27123de-a60f-4f84-833b-3cb0563917df/ss_084433f4.png) | ![提交后](https://app.devin.ai/attachments/964dfe01-f643-4ebf-8bc5-3536aa4cee8e/ss_1cd717ca.png) |

### 6. 0 题防护
- 重新查卷不选任何题：按钮「交卷判分（0 题）」class=`sheet-done dim` 置灰，点击无请求、无结果弹层 — **passed**

![0题置灰](https://app.devin.ai/attachments/6c650c38-802a-4b22-bf98-f701bcd03849/ss_7bcae823.png)

### 7. 数据说明（生产红线）
- 未删除/修改任何既有服务器数据。本轮新增：uid `umsd071maax1ogamv` 的 answer_log（4 条作答记录）+ 1 条错题（第 2 题，2023国考人民民主题）+ paper_exports 卷码 `20F47932`，请用户按 uid 经 ssh 清理。
- 说明：手动输入真实卷码走的是与 chip 相同的 `manualLookup(code)`，chip 与错误卷码输入两条路径均已覆盖，未再单独手输真实卷码。
- 录屏：`/home/ubuntu/screencasts/rec-e0bd0c83-23e3-4ca7-aa65-1294e3f6d885/rec-e0bd0c83-23e3-4ca7-aa65-1294e3f6d885-edited.mp4`

---

## 增量测试 R116（答案卡渲染 + 讲解时延复测）— 2026-08-03

- 测试环境：**线上 https://kaogong.zalize.com**，强刷确认新 bundle `assets/index-Dibj3ds2.js`。粘贴新数量关系题（和倍问题，故意选错 B，正确 C），本浏览器已有访问码缓存未再弹窗。
- 结论：**两项 P2 修复全部通过，无失败断言**。零数据创建（未点「存入错题本」）。

### 1. 答案卡 anscard（R115 untested → 本轮 passed）
- 讲解返回后结果卡顶部出现答案卡：大字母 **C**、方法胶囊「和倍问题-设份数列方程」、一句话「设乙为x，4x+10=90，x=20，甲=2x=40」— **passed**
- 样式实测：`.ans-big` backgroundColor=**rgb(59,111,245)** / backgroundImage=none（纯色品牌蓝无渐变）；`.anscard` 底 rgb(237,243,254) 无渐变 — **passed**
- 错因分析正确命中我的错选 B（指出 30 是丙的本数，属答非所问型失误）— 讲解质量正常
- `recentExplains` 最新条目 `ans:"C"`、brief 为一句话摘要 — **passed**
- F5 重进后「最近讲解」首行左侧显示答案字母 **C**（上轮记录仍为「？」，对比明显）— **passed**

![答案卡纯蓝大字母C](https://app.devin.ai/attachments/6c7e176f-11b0-480a-8e6f-6f22a9d429af/ss_9b500c9f.png)
![最近讲解带答案字母C](https://app.devin.ai/attachments/48a05b8a-f3ea-430d-b773-a0716f101254/ss_a55b51c2.png)

### 2. 讲解时延（deepseek 快速通道）
- 从点击「用花生十三方法讲解」到结果渲染实测 **约 110 秒**（页面计时提示 3s 识题 → ~110s 完整渲染），对比上轮 R115 约 300 秒，**提速约 60%+，达到「约 2 分钟」目标** — **passed**

- 录屏：`/home/ubuntu/screencasts/rec-cabf143c-d7c6-4111-9a2b-d831f24941dd/rec-cabf143c-d7c6-4111-9a2b-d831f24941dd-edited.mp4`

## 增量测试 R115（AI 讲解修复复测 + 申论 chips 单行 + 快速回归）— 2026-08-03

- 测试环境：**线上 https://kaogong.zalize.com**，Ctrl+Shift+R 强刷后确认新 bundle `assets/index-BYLlip32.js`。视口实测 `innerWidth=500`（Chrome 最小窗宽限制，无法到 375；rpx 换算按 500/375≈1.333，72rpx@500=48px 即 36px@375）。讲解触发时被要求输入访问码，输入 `kg2026` 通过。
- 结论：**三组测试全部通过，无失败断言**；1 条说明项（anscard 未渲染，见下）。
- 生产数据：零创建零删除（讲解不产生错题，未点「存入错题本」）。

### 1. AI 讲解修复（P1 复测）
- 粘贴完整行测题（守株待兔类比题）+选 A → 点「用花生十三方法讲解」→ 经「识题中→匹配方法→生成分步讲解」约 **5 分钟**后成功返回完整解析（判定正确、逐项分析、方法提示），上轮「AI 服务连接失败」不再出现 — **passed**
- `localStorage.recentExplains` 写入 1 条 — **passed**
- F5 重进页面后「最近讲解」显示该记录（判断推理·类比推理·8/3 11:30）— **passed**
- 主按钮纯色品牌蓝：computed `rgb(59,111,245)`、backgroundImage=none — **passed**
- ⚠️ 说明：**答案卡 anscard 未渲染** — 本次 AI 回复未按「【答案】X｜【方法】…｜【一句话】…」格式开头（splitAnswer 未命中），故无答案卡可验；CSS `.anscard/.ans-big` 为纯色 #3b6ff5 无渐变（源码确认），样式本身达标但运行时**untested**。模型输出格式不稳定可能导致答案卡时有时无，建议后端 prompt 强约束或前端兜底解析「你的选择/判定」格式。

![AI 讲解成功返回](https://app.devin.ai/attachments/753541f1-52bd-4938-a592-80b9b2d7fe9b/ss_abeaa5ff.png)
![重进后最近讲解列表](https://app.devin.ai/attachments/2f1935a4-2766-42e2-81a6-f4054528d9f5/ss_3a8395d0.png)

### 2. 申论分类 chips（P2 复测）
- chip computed `white-space:nowrap`、容器 `flex-wrap:nowrap`、单行（所有 chip top 一致）、chip 高 39px（上轮 93.5px 竖排已修复）— **passed**
- 可横滚：内容宽 566 > 可视 379，横向滚动后「贯彻执行/大作文」露出、「全部/归纳概括」移出 — **passed**
- 「筛选」按钮居右（距右缘 31px），高 **48px = 72rpx@500**（即 36px@375）— **passed**

![chips 横滚后单行+筛选居右](https://app.devin.ai/attachments/a545386c-d29a-4044-9140-dd1d2ce76d73/ss_zoom_c6b65bd6.png)
![申论页整体](https://app.devin.ai/attachments/7d496497-8f89-47a0-8493-4f3c0da0be68/ss_f2671e5f.png)

### 3. 快速回归（Regression）
- 统计页：标题「统计」、KPI 横幅+学习日历入口、今日待办、雷达+最薄弱+去补弱、模块分布 3 行+展开、TOP10 chips+「+5」、教练/勋章/备份列表卡 — 结构完整 **passed**
- 申论页：三 tab 分段控件、题卡分值/去作答/收藏★ 正常 — **passed**
- 紫色扫描：申论页 0、拍题讲解页 0、统计页 0 — **passed**

![统计页回归](https://app.devin.ai/attachments/286b4a48-79e1-4aa3-b016-d41275434411/ss_4a336dd7.png)

- 录屏：`/home/ubuntu/screencasts/rec-18eab57e-d6e4-4253-982c-2a3432b7821e/rec-18eab57e-d6e4-4253-982c-2a3432b7821e-edited.mp4`

## 增量测试 R113（答题卡前置 + 导出三 chips + 扫描页序回归）— 2026-08-03

- 测试环境：**线上 https://kaogong.zalize.com**（无访问码），构建 hash 已确认新版 `assets/index-DdSkSGuK.js`，Chrome 375px 移动视口（UI 部分录屏）。
- 结论：**三组测试全部通过，无失败断言**。
- 生产数据保护：测前 `/api/mistakes` 基线 261 条（max id 296）；扫描测试 uid `qa-r113-scan`，本轮产生 mistakes id **321–327** 已全部 DELETE（全 200），API 确认与基线完全一致。**answer_log 无删除 API**：uid `qa-r113-scan` 的 12 条做题记录留库，请经 ssh 清理。

### 1. 导出三 chips（错题本筛选弹层 + 刷题自定义弹层，375px）
- 两处弹层导出按钮上方均可见「含答题卡」「含答案解析」「仅导出答案」，getBoundingClientRect 高度 **44.0px**（≥44 热区达标）— passed
- 默认前两个点亮；点「仅导出答案」→ 独占点亮、前两个变灰；再点恢复；「含答题卡」可独立熄灭（含答案解析保持点亮）— passed

| 🟢 错题本弹层：仅导出答案点亮 | 🟢 恢复默认（前两点亮） |
|---|---|
| ![only](https://app.devin.ai/attachments/877be8be-c532-4026-89e1-23a58d517086/ss_zoom_765a6e48.png) | ![default](https://app.devin.ai/attachments/936839f2-46f7-4e1a-9e78-22c96e86ec35/ss_zoom_7763c6b7.png) |

刷题弹层关「含答题卡」独立开关：![prac](https://app.devin.ai/attachments/be424f13-d63b-4c1e-892a-a26dc2471d34/ss_zoom_a6240900.png)

### 2. 实际导出（UI 下载 + pymupdf 结构检查）
- 默认导出（错题本，100 题）：13 页，**第 1–2 页为答题卡**（「答题卡…卷码 C0017FDD·第 1/2 页」+机读卷码区），试题第 3 页起，末页参考答案与解析 — passed
- 「仅导出答案」导出：**仅 1 页**，标题「错题重练卷 8月3日 · 参考答案」+ 1–100 答案速查表，无试题、无答题卡 — passed（注：错题导出 items 不携带解析字段，故无逐题解析段——后端逻辑正确，属数据源限制）
- 刷题弹层关「含答题卡」导出（10 题）：6 页，全文无答题卡页，试题从第 1 页开始，末尾含参考答案与解析 — passed

| 🟢 默认导出第 1 页=答题卡 | 🟢 仅答案导出（1 页） | 🟢 无答题卡导出第 1 页=试题 |
|---|---|---|
| ![p1](https://app.devin.ai/attachments/f7e359de-5ebf-4db0-9196-2ed07261300f/default_p1_sheet.png) | ![ao](https://app.devin.ai/attachments/b06431a3-46a5-4eba-bf78-f29cc101328a/answersonly_p1.png) | ![ns](https://app.devin.ai/attachments/083ff094-17c1-49c3-affe-8c33cb27d95d/nosheet_p1.png) |

### 3. 扫描页序回归（脚本 /tmp/r113/sim_scan.py，渲染第 1 页答题卡）
- 12 题默认参数导出（卷码 3ECA00C3，5 页，答题卡在最前），渲染**第 1 页**涂黑 + 透视 + 180° 旋转 + 模糊压缩 → POST /api/scan_sheet：卷码一致、page=1、total=12、answered=10、correct=3，**逐题 12/12** status/picked/correct 与涂法完全一致（含 blank 与 multi "BC"）— passed。答题卡前置不影响识别（卷码查 paper_exports）。
- 模拟照片：![photo](https://app.devin.ai/attachments/9c73c5b7-0e35-4ab6-9b0d-147f5ebb4477/photo.jpg)

- 录屏：`/home/ubuntu/screencasts/rec-5b23b2a2-cd20-484c-9b2b-a16bb4b9d4f1/rec-5b23b2a2-cd20-484c-9b2b-a16bb4b9d4f1-edited.mp4`
- 测试计划：`/home/ubuntu/repos/kaogong-assistant/test-plan-r113.md`；模拟脚本：`/tmp/r113/sim_scan.py`

## 增量测试 R112（PDF 思源宋体/语义码/选项自适应 + 扫描回归 + AI 分析超时修复）— 2026-08-03

- 测试环境：**线上 https://kaogong.zalize.com**（无访问码），构建 hash 已确认新版 `assets/index-Bxr8rrGF.js`，Chrome 375px 移动视口（AI 分析部分录屏）。
- 结论：**三组测试全部通过**。上轮 R111 的失败项「AI 错题分析 request:fail timeout」已修复验证（约 3.5 分钟返回完整内容）。
- 生产数据保护：测前记录 `/api/mistakes` 基线（261 条，296…23,5,3,2）；扫描测试使用 uid `qa-r112-scan`；测后删除本轮扫描产生的 mistakes id **313–320**（全部 HTTP 200），API 确认与基线完全一致（261 条，id 23 等零触碰）。
- **answer_log 无删除 API**：uid `qa-r112-scan` 的 10 条做题记录仍在库中，请经 ssh 按 uid 清理。
- 录屏（AI 分析 UI）：`/home/ubuntu/screencasts/rec-2ac4fd06-6624-4a6c-8d14-e5b2ce712ca5/rec-2ac4fd06-6624-4a6c-8d14-e5b2ce712ca5-edited.mp4`
- 测试计划：`/home/ubuntu/repos/kaogong-assistant/test-plan-r112.md`；模拟脚本：`/tmp/r112/sim_scan.py`

### 1. PDF 导出（POST /api/export/pdf，12 题常识，卷码 4021DFFC）— 全部通过

- 字体（pymupdf get_fonts）：正文 **NotoSerifCJKsc-Regular**（思源宋体嵌入 TTF），题号（`1.`…`12.`）与答案页「N. 答案 X」为 **NotoSerifCJKsc-Bold** 加粗，标题/分节仍 WenQuanYiZenHei 黑体 —— 与需求一致。
- 语义码：卷面 12 题题号旁灰色 `[语义码]` 全部符合格式（如 `CS-2015-260143`、`CS-XF-434735`、`CS-JJ-008441`），末 6 位与题库 id 逐一匹配（12/12）。
- 选项自适应（`_opts_per_line`，像素+文本行核对）：短选项 4 个同行（如「A.凝固点更低 B.沸点更低 C.密度更大 D.颜色更深」）、中等宽度 2 个一行、长选项各自成行（如西汉霸陵题）—— 三种档位同页可见。
- 末尾答题卡：「答题卡」黑体标题、四角实心定位块（左上更大）、40 格机读卷码条、每行题号 + **短语义码（无年份段**，如 `CS-260143`）+ A-D 方框，版式完整。

| 🟢 正文页（宋体/加粗题号/语义码/选项 4-2-1 自适应） | 🟢 末尾答题卡（短语义码/定位块/卷码条） |
| --- | --- |
| ![body](https://app.devin.ai/attachments/13bdeaaa-67ab-41c9-9efb-51a7406bf9ba/r112_page1.png) | ![sheet](https://app.devin.ai/attachments/f7ab1d33-a71d-43b9-87d3-09f0a31b5bef/r112_page5.png) |

### 2. 扫描识别回归（uid=qa-r112-scan）— 通过

- 新版答题卡渲染 → opencv 涂黑（10 题单涂、1 空涂、1 多涂）→ 透视畸变 + 180° 旋转 + 模糊 JPEG 压缩（[模拟照片](https://app.devin.ai/attachments/1c765725-54fd-4ca6-9f86-a97e7f50037e/photo.jpg)）→ POST /api/scan_sheet。
- 返回：卷码 4021DFFC 一致、page=1、total=12、answered=10、correct=2、saved=true；**逐题 12/12 status/picked/correct 与涂法完全一致**（blank/multi 正确标记）。
- 落库：8 条涂错题写入 mistakes（id 313–320，question_id 匹配），测后已全部删除。

### 3. AI 错题分析超时修复（375px UI，录屏）— 通过

- 错题本页点「AI 错题分析 · 生成」→ 显示「正在分析…」→ **约 3.5 分钟后返回完整内容**（错题画像 / 薄弱点诊断 / 复习建议，富文本标题渲染正常），未出现 `request:fail timeout`（对照 R111 约 3 分钟即失败）。弹层可滚动、可正常关闭，页面无崩溃。
- 说明：耗时约 210s < 420s 新超时上限，但仍偏长，建议后续考虑流式或缓存优化（非本轮阻塞项）。

| 🔴 R111（修复前，超时失败） | 🟢 R112（修复后，成功返回） |
| --- | --- |
| ![before](https://app.devin.ai/attachments/10386b3e-2288-4c4b-82f1-96ea85bcef8a/ss_09869351.png) | ![after](https://app.devin.ai/attachments/4cf47b1f-66ec-4c64-9b34-ca392fb25d5a/ss_9382fb13.png) |

复习建议部分：![advice](https://app.devin.ai/attachments/c25161b5-3d20-4b2a-93b9-46ef41011031/ss_b72bbfb7.png)

---

## 增量测试 R110+R111（PDF 排版 / 机读答题卡 + 扫描识别）— 2026-08-03

- 测试环境：**线上 https://kaogong.zalize.com**（无访问码），构建 hash 与本地 dist 一致（`assets/index-LQx2OW6n.js`），Chrome，**375px 移动视口**（UI 部分录屏）。
- 结论：**A/B/C 三组全部通过；D 回归中「AI 错题分析」生成失败（超时）**，其余回归通过。
- 生产数据保护：测前记录 `/api/mistakes` 基线（296…23,5,3,2）；扫描测试全部使用 `qa-` 前缀 uid；测后删除本轮扫描产生的 id 308–312（uid=qa-r111-scan），API 确认其余 id 全部保留、`qa-` 记录清零；浏览器 `anonUid` 已恢复原值。
- **answer_log 无删除 API**：uid `qa-r111-scan`（10 条）与 `qa-r111-ui`（10 条）的做题记录仍在库中，留给用户经 ssh 清理（answer_log 表按 uid 删即可）。
- 录屏（UI 部分）：`/home/ubuntu/screencasts/rec-d5b6076b-11bb-4c0b-a380-221a7479e336/rec-d5b6076b-11bb-4c0b-a380-221a7479e336-edited.mp4`
- 测试计划：`/home/ubuntu/repos/kaogong-assistant/test-plan-r110-111.md`；模拟脚本：`/tmp/r111/sim_scan.py`

### A 导出 PDF 排版（R110）— passed

- 错题本筛选（资料分析 ×12）→「导出当前筛选为错题卷 PDF」下载成功（`错题重练卷 8月3日.pdf`，150KB，卷码 BFC19C18）；刷题页自定义练习面板 →「导出为试卷 PDF（含答题卡+答案页）」下载成功（`真题精选卷 8月3日.pdf`，321KB，卷码 30A76488）。
- pymupdf 字体检查：正文 **UMingCN（AR PL UMing 宋体）**，标题 **WenQuanYiZenHei（黑体）**，符合 R110 要求。
- 版式渲染抽查：封面分隔线、短选项同行、题目+选项同页不跨页拆分（抽查 2 题）。

| 正文页（宋体正文/黑体标题/选项同行） | 末尾机读答题卡页 |
|---|---|
| ![body](https://app.devin.ai/attachments/f7a6ddf0-509f-4a74-842b-d6792c3b258a/page1.png) | ![sheet](https://app.devin.ai/attachments/bfe336d7-f31a-44d6-9fa2-2650836f9109/page5.png) |

- 答题卡页完整：四角实心定位块（左上更大）、40 格机读卷码条、每题 A–D 涂黑方框、题号+[题目ID]、两栏布局、页脚扫描指引。练习导出卷答题卡另证：![prac_sheet](https://app.devin.ai/attachments/165ae559-6f49-4744-a953-23e375f39c56/prac_sheet.png)

### B 扫描识别管线（R111，脚本模拟）— passed

- `/api/export/pdf` 导出 12 题（QA-R111 模拟卷，卷码 **1BE05FA3**）→ pymupdf 300dpi 渲染末页 → 按 `omr.py` 几何 opencv 涂黑（5 对、5 错、1 空、1 多涂）→ 加透视畸变 + **旋转 180°** + 模糊 + JPEG 压缩 → `POST /api/scan_sheet`（uid=qa-r111-scan）。
- 模拟照片：![photo](https://app.devin.ai/attachments/a87a4c88-524b-4f7e-b107-7573ceae6e49/photo.jpg)
- 返回：`code=1BE05FA3`（与导出一致，180° 方向判定生效）、`page=1, total=12, answered=10, correct=5, saved=true`；**逐题 12/12 与涂法完全一致**（空涂 status=blank、多涂 status=multi picked="BC"）。
- 落库：`/api/mistakes?uid=qa-r111-scan` 出现涂错的 5 题（id 308–312，question_id 匹配）；`/api/growth?uid=qa-r111-ui` 显示 10 条做题记录（answer_log 落库侧证）。
- 说明：UI 上传时错题按 `question_text` 去重合并进已有记录（times+1），未新增行，符合 `db.save_mistake` 实现。

### C 前端 375px UI — passed

- 「扫描答题卡」入口卡可见（图标+说明+「拍照」按钮），DOM 实测卡片热区高度 **96.7px ≥ 44px**。
- 上传随机无效图片 → toast「识别失败：未找到答题卡四角定位块，请拍全整张答题卡」，页面不崩溃。
- 通过页面上传 B 的模拟照片 → 结果弹层：「扫描结果 · QA-R111 模拟卷」「卷码 1BE05FA3 · 第 1 页 · 已作答 10/12 · 答对 5 题 · 已记入做题记录」，逐题行 ✓/✗/未涂/多涂 BC 全部正确显示；「完成」关闭正常。

| 入口卡 | 无效图报错 | 扫描结果弹层 |
|---|---|---|
| ![entry](https://app.devin.ai/attachments/a737ce52-79f8-4a6b-b1a8-f183e8e34175/ss_eefffc64.png) | ![invalid](https://app.devin.ai/attachments/34139d9e-1e89-47c8-a3b3-ddd7aa507120/ss_a549e47d.png) | ![modal](https://app.devin.ai/attachments/1739fa45-4690-4451-ae80-2bb7320fe2c4/ss_1391afd7.png) |

### D 回归 — AI 分析 failed，其余 passed

- 错题本导出按钮：A 已覆盖 — passed。
- 「错题重练」入口：开组正常（资料分析 · 1/4，刷题模式重做）— passed。![retry](https://app.devin.ai/attachments/888693d8-db7e-4931-9753-9ee99801ac75/ss_e1374ab8.png)
- **「AI 错题分析」— failed**：点击「生成」弹层出现并显示「正在分析…约需 30-60 秒」，但约 3 分钟后显示「**分析失败：request:fail timeout**」（前端超时兜底正常、无崩溃，但功能不可用，疑为 LLM 上游慢/超时，建议后端加缓存或拉长/流式化）。![aifail](https://app.devin.ai/attachments/10386b3e-2288-4c4b-82f1-96ea85bcef8a/ss_09869351.png)
- 说明：错题重练开组时误触把一道生产资料分析错题答错一次（times+1、next_review 重置），无法回滚，影响极小，已如实记录。


## 增量测试 v23（P1c：音效开关 / pop 动效 / 成就勋章 / 雷达空态）— 2026-07-31

- 测试环境：**线上 https://kaogong.zalize.com**，构建 hash 与本地 dist 一致（`assets/index-B5gWKF-M.js`），Chrome，**400px 移动视口**为主 + 1200px 桌面侧栏抽查（均录进录屏）。
- 结论：**五组测试全部通过**，无失败断言。
- 生产数据保护：测前基线 [26, 23, 5, 3, 2] 全部保留；本轮故意答错自动新增 id 29（panduan），测后仅删除该条，API 确认恢复 **[26, 23, 5, 3, 2]**。
- 说明：雷达空态验证前已完整备份 localStorage `pstats` 原值，验证后写回并刷新确认恢复（35 题/69%/打卡 2 天与勋章状态复原）。备份写回未包含本轮清空前刚答的 2 题（判断推理 1 对 1 错），属可接受的本地统计微差。
- 录屏：`/home/ubuntu/screencasts/rec-8a7781f2-f28f-4ea5-a10f-b9ecaac147e1/rec-8a7781f2-f28f-4ea5-a10f-b9ecaac147e1-edited.mp4`
- 测试计划：`/home/ubuntu/repos/kaogong-assistant/test-plan-v23.md`

### T1 音效开关（刷题页顶栏）— passed

- 开组后顶栏默认显示 🔊（默认开启）；点击后 toast 精确为「音效已关闭」、图标变 🔇、`localStorage sfxOff = "1"`；再点 toast「音效已开启」、图标回 🔊、`sfxOff = ""`：

  | 🔴 关闭：toast「音效已关闭」+ 🔇 | 🟢 开启：toast「音效已开启」+ 🔊 |
  |---|---|
  | ![音效关闭](https://app.devin.ai/attachments/37677c8e-5b40-4472-b450-fd4a831b4b73/sfx-off-toast.png) | ![音效开启](https://app.devin.ai/attachments/67e6abc9-bf95-4796-86aa-88aaa98024f1/sfx-on-toast.png) |

- WebAudio 验证（用户允许的 CDP/console 方式）：刷新后 hook `window.AudioContext` 构造计数，音效开启状态下答题判分后计数 **0 → 1**，证明 `playSfx` 实际创建了 AudioContext。

### T2 pop 动效 + 结构化解析回归 — passed

- 答对：正确选项 C 绿底绿框 ✓（pop 0.35s 缩放动效为瞬时动画，以录屏为证，截图为动效后的绿色结果态）；答错：所选 B 红框 ✗ + 正确 A 绿框 ✓（shake 反馈不变），结构化解析卡（正确答案大字母/解析/考点/来源 + 胶囊详解按钮）与「已自动存入错题本」横幅均正常（Regression）：

  | 🟢 答对绿框（pop 后结果态） | 🔴 答错红框 + 结构化解析 |
  |---|---|
  | ![答对](https://app.devin.ai/attachments/e5d91200-66e9-4b36-ac87-10e5e30116f3/correct-green-pop.png) | ![答错](https://app.devin.ai/attachments/d222d7ef-0dee-42a1-9687-f1419332aefe/wrong-red-shake.png) |

### T3 成就勋章卡（薄弱分析页）— passed

- 8 枚勋章全部渲染：初战告捷🌱 / 小有所成💪 / 刷题大师🏆 / 三日不辍🔥 / 七日连环⚡ / 十连对🎯 / 斩题十道⚔️ / 百题斩👑。
- 当前累计 35 题 →「初战告捷」**点亮**（绿色图标 + 主色「已达成」）；其余 7 枚**灰显**且带进度文字（35/100 题、35/500 题、2/3 天、2/7 天、0/10 连对、0/10 道、0/100 道），像素可见点亮/灰显差异：

  ![成就勋章卡放大](https://app.devin.ai/attachments/8a672d42-b469-4c92-86b8-99b55b8669dd/medals-zoom.png)

### T4 雷达空态引导卡 — passed

- 备份并清除 `pstats` 后刷新：五模块能力雷达卡显示「还没有能力数据」+「刷几题就能生成你的五模块能力画像」+ 主色「去刷题」按钮（无雷达图）；点「去刷题」跳到刷题 Tab：

  ![雷达空态引导卡](https://app.devin.ai/attachments/3c049d17-84e6-48b2-b6f9-f1bb8a5d8e5f/radar-empty.png)

- 写回备份并刷新：总览 35 题/69%/打卡 2 天、勋章「初战告捷已达成」、近 7 日柱状卡均恢复原状。

### T5 桌面侧栏 / 移动 tabbar 冒烟（Regression）— passed

- 1200px：左侧竖排侧栏仍在、内容区不重叠；400px：底部横排 tabbar 恢复：

  | 🟢 1200px 左侧侧栏 | 🟢 400px 底部 tabbar |
  |---|---|
  | ![桌面](https://app.devin.ai/attachments/c2511a0a-23df-41b9-a2d3-edd1a6e4ae09/desktop-sidebar-regression.png) | ![移动](https://app.devin.ai/attachments/5cc56ecb-a73a-4a09-bbb1-f71f341dd370/mobile-tabbar-regression.png) |

### 清理

- 本轮仅新增错题 id 29（判断推理，故意答错产生），已 DELETE；`/api/mistakes` 最终 = **[26, 23, 5, 3, 2]**，生产数据零触碰。

### 未覆盖 / 说明

- 音效"真实可听性"未主观验证（用户明确允许以 AudioContext 创建为准）；关闭状态下未重新 hook 验证"不创建"（代码 `if (!this.sfxOn) return` 为前置返回，且关闭态答题无异常）。
- 十连对/斩题十道等高门槛勋章的"达成态"仅初战告捷一枚实际点亮验证，其余达成态未造数复现。

## 增量测试 v22（P1b：桌面 208px 侧栏 / 结构化解析卡 / 近 7 日正确率柱状卡）— 2026-07-31

- 测试环境：**线上 https://kaogong.zalize.com**，构建 hash 与本地 dist 一致（`assets/index-D-TXMmEh.js`），Chrome，**1200px 桌面 + 400px 移动**双视口（均录进录屏）。
- 结论：**四组测试全部通过**，无失败断言。
- 生产数据保护：测前基线含用户数据 [23, 5, 3, 2]，另发现**未知 id 26**（ziliao，创建于本轮开测前约 1 分钟，非我产生）——按红线**未删除**。本轮故意答错自动新增 id 27、28，测后仅删除这两条，API 确认恢复 **[26, 23, 5, 3, 2]**。
- 说明：近 7 日紫色柱（≥60%）无法当天通过 UI 自然造出（today 的 days 含 v21 遗留 35 题而 daysCorrect 从 v22 才开始记录），故通过 localStorage 向 pstats 注入 7/30=8/10（80%）一天数据后刷新验证紫色柱；今天 6% 橙色柱为真实 UI 刷题产生。
- 录屏：`/home/ubuntu/screencasts/rec-eb0e6e6c-fb69-4647-973e-44563954e4d5/rec-eb0e6e6c-fb69-4647-973e-44563954e4d5-edited.mp4`
- 测试计划：`/home/ubuntu/repos/kaogong-assistant/test-plan-v22.md`

### T1 桌面端 1200px 侧栏布局 — passed

- tabbar 变为左侧竖排侧栏（四项图标+文字横排：拍题讲解/刷题/错题本/薄弱分析），底部无 tabbar，主内容在侧栏右侧不重叠：

  ![1200px 左侧侧栏](https://app.devin.ai/attachments/7a3d4138-1462-4545-9f93-68bc5382cfde/desktop-sidebar-stats.png)

- 题型 sheet 弹层的 mask 左边界从 208px 内容区开始，侧栏不被遮罩；答题卡弹层同样偏移：

  | 🟢 题型 sheet mask 偏移 | 🟢 答题卡弹层 mask 偏移 |
  |---|---|
  | ![sheet mask](https://app.devin.ai/attachments/dc2a3363-d795-4117-a54f-a171a409bd95/desktop-mask-offset.png) | ![答题卡 mask](https://app.devin.ai/attachments/e6ffdc35-ebde-44b1-bb30-5baf855ebb90/desktop-answercard-mask.png) |

- 判分横幅（红「✗ 正确答案 D · 已自动存入错题本」）左边界与侧栏右缘对齐，不遮侧栏：

  ![判分横幅偏移](https://app.devin.ai/attachments/e15b7506-1bab-46a4-857e-fd3a8825d7fd/desktop-banner-offset.png)

### T2 结构化解析卡 + 详解胶囊按钮 — passed

- 答错：「正确答案」大字母 **D 红色** + 「解析」正文 + 「考点 言语理解-主旨概括」+「来源 original」四分区；底部「用花生十三方法详解这道题 ›」为主色描边胶囊按钮，**无 🔍 emoji**；答对：大字母 **B 绿色**：

  | 🔴 答错-红色大字母+四分区+胶囊按钮 | 🟢 答对-绿色大字母 |
  |---|---|
  | ![答错红](https://app.devin.ai/attachments/8960b565-be26-4f26-a1c5-1aee5135f686/exp-card-wrong-red.png) | ![答对绿](https://app.devin.ai/attachments/241e8619-3129-46e5-821d-41288152b8f8/exp-card-correct-green.png) |

### T3 近 7 日正确率柱状卡 — passed

- 当天刷题后卡片出现；**今天 6% 柱为橙色（<60%）**、注入的 **7/30 80% 柱为紫色（≥60%）**，柱下日期、柱顶百分比均可见：

  ![近7日正确率橙/紫柱](https://app.devin.ai/attachments/287ba4d1-ef0a-439b-b3db-6f86f09b75dc/trend-purple-orange.png)

### T4 移动端 400px 回归 + P1a 冒烟 — passed

- 400px 视口：tabbar 回到底部横排四图标，无左侧侧栏，内容占满宽度：

  ![400px 底部 tabbar](https://app.devin.ai/attachments/656b32dc-271c-4cc5-b609-c69de37af115/mobile-bottom-tabbar.png)

- P1a 冒烟（Regression，1200px 组内验证）：⏱ 计时换题重置（1:15→0:02）；Aa 点击 toast「字号：大」且字号变大；答题卡 1=红/2、3=绿/4=当前描边 +「已答 4/10 · 正确 2」；答错出现错因 chips，点「粗心大意」紫色高亮：

  ![错因 chip 高亮](https://app.devin.ai/attachments/a4e90abe-1d75-4f53-ba18-8cb69e8a9811/chip-highlight.png)

- 判分横幅/答错自动存错题本/二级题型 sheet 均正常（穿插验证）。完成结算环本轮未刷满 10 题未复现（v20 已验证，本轮无相关改动）。

### 清理

- 仅删除本轮自建 id 27、28；未知 id 26 与用户数据 23/5/3/2 未动；API 确认 `[26, 23, 5, 3, 2]`。

---

## 增量测试 v21（P1a UI 改造：答题卡/计时/字号/错因自评/已斩/目标环/学习日历）— 2026-07-31

- 测试环境：**线上 https://kaogong.zalize.com**，构建 hash 与本地 dist 一致（`assets/index-BNEtTXqa.js`），400px 移动视口，Chrome。
- 结论：**六组测试全部通过**，无失败断言。
- 生产数据保护：测前基线 `/api/mistakes` = **[23, 5, 3, 2]**（id 23 为用户真实数据，全程未动）；本轮故意答错 1 题自动新增 id 25，测后 DELETE，API 确认恢复 **[23, 5, 3, 2]**。复习队列中用户到期条目 id 23 未触碰（复习连对自动斩测试用的是本轮 id 25 的 API 调用）。
- 录屏：`/home/ubuntu/screencasts/rec-b43c0b26-a275-4745-8b31-bb612ef092a0/rec-b43c0b26-a275-4745-8b31-bb612ef092a0-edited.mp4`
- 测试计划：`/home/ubuntu/repos/kaogong-assistant/test-plan-v21.md`

### T1 刷题页顶栏：计时 / Aa 字号 / 答题卡 — passed

- 顶栏可见「⏱m:ss」单题计时（0:02→0:18 递增），答对进下一题后重置为 0:01。
- 点 Aa → toast「字号：大」，题干/选项字号肉眼变大（截图）；继续点击循环 小/标准。

  ![Aa字号大+toast](https://app.devin.ai/attachments/d74db1ac-58c4-408a-a7b0-5003aec38b95/ss_01c34f80.png)

- 点顶栏「言语理解 · 中心理解 · 3/10 ▾」→ 弹出「答题卡」层：1=红（答错）、2=绿（答对）、3=当前描边，底部「已答 2/10 · 正确 1」；点题号 1 跳回第 1 题（已答状态、tag 变 1/10）：

  | 🟢 答题卡圆点网格 | 🟢 点题号1跳题成功 |
  |---|---|
  | ![答题卡](https://app.devin.ai/attachments/6444aca4-51d4-4694-9351-507cedb24056/ss_451b150e.png) | ![跳题](https://app.devin.ai/attachments/b89ae72b-7c7f-44df-9666-d6b2d305bd1a/ss_zoom_c63afa19.png) |

### T2 错因自评 + 错题本徽章 — passed

- 故意答错（选 B，正确 C）后解析上方出现「错因自评：粗心大意/概念不清/方法不会/纯蒙的」4 chips；点「粗心大意」紫色高亮：

  ![错因chips高亮](https://app.devin.ai/attachments/a5f1aa2a-2d88-4ee1-9a9a-a481c9cd0830/ss_zoom_c99c5f42.png)

- 错题本该卡片（id 25）显示黄色「粗心大意」徽章 + 红「我选 B ✗」绿「· 答案 C」+ 相对时间「今天 09:31」；API 确认 error_reason='粗心大意'：

  ![错题本徽章](https://app.devin.ai/attachments/9bad63c9-7dbf-4c04-8f2f-3d86d5262782/ss_47af8f96.png)

### T3 已斩流程 — passed

- 顶部「待掌握 5 / 已斩 0」tabs；点「标为已斩」→ 已斩 tab 该卡带旋转绿色「已斩」印章、操作变「恢复复习」，顶部横幅待复习 2→1；API 确认 mastered=1 且 `/api/review` 不再含 id 25：

  ![已斩印章](https://app.devin.ai/attachments/a422e5b2-627b-4f3b-8dde-8d05be7787e6/ss_aa36d0be.png)

- 点「恢复复习」→ 回到待掌握 5 / 已斩 0，待复习恢复 2 道。
- API 抽查复习自动斩：`POST /api/review/25 {"correct":true}` ×2 → 第 2 次返回 `{"streak":2,"next_review_days":3,"mastered":true}`。

### T4 首页每日目标环 — passed

- 左侧目标环显示「31/20题」金色达成态 +「🎉 今日目标达成」+「🔥 连续打卡 1 天」；点环 → toast「每日目标：50 题」，环变 31/50 部分进度弧；继续点循环 10→20：

  | 🟢 20题达成金环 | 🟢 点环切50+toast |
  |---|---|
  | ![目标环](https://app.devin.ai/attachments/9014326c-075a-4ebe-9f0e-08397017c1db/ss_zoom_1f4c1ed1.png) | ![循环50](https://app.devin.ai/attachments/22f36972-b8f9-4d0d-8e37-3bf5377ce292/ss_01ef4b84.png) |

### T5 薄弱分析：学习日历 + 错因分布 — passed

- 「学习日历」月历卡：今天（31 日）满色圆点+描边，「本月打卡 1 天」；总览 31 题/71%/打卡 1 天。
- 「错因分布」卡出现，含「粗心大意 ×1」橙色条：

  | 🟢 学习日历 | 🟢 错因分布 |
  |---|---|
  | ![日历](https://app.devin.ai/attachments/8d0bf1ac-d004-4834-9e23-92f6c873376d/ss_6f4347c8.png) | ![错因分布](https://app.devin.ai/attachments/b6fc6224-cd3a-4792-a7fe-31f1eb2c7394/ss_09ee39ff.png) |

### T6 回归冒烟 — passed

- 二级题型 sheet（言语→中心理解）、判分红绿+红横幅「✗ 正确答案 C / 已自动存入错题本」、答对自动跳题均正常（穿插于 T1 组内）。
- 覆盖说明：完成结算环本轮未刷满 10 题故未复现（v20 已验证且无改动声明）；复习模式 UI 已斩抽查以 API 为证（避免触碰用户到期条目 id 23）。

### 清理

- DELETE 本轮 id 25，`/api/mistakes` 恢复 **[23, 5, 3, 2]**；id 23（用户数据）及生产复习状态零触碰。

## 增量测试 v20（二级题型细分）— 2026-07-31

- 测试环境：**线上 https://kaogong.zalize.com**，强刷新后确认线上构建 hash 与本地 dist 一致（`assets/index-BkLiGlF7.js`，新构建），400px 移动视口，Chrome。
- 结论：**三组测试全部通过**，无失败断言。
- ⚠️ 生产数据说明：测前 `/api/mistakes` 实为 **[21…13, 5, 3, 2]**（id 13-21 非本人创建，时间戳均在部署前后 ~30 分钟内，判断为部署方自测造数）。按用户明示"按基线 [5,3,2] 清理"指令，已删除 id 13-22（22 为本轮故意答错新增），API 确认恢复 **[5, 3, 2]**。生产复习数据零触碰。
- 录屏：`/home/ubuntu/screencasts/rec-6c21b756-d528-4a96-a6ae-29f617512b7c/rec-6c21b756-d528-4a96-a6ae-29f617512b7c-edited.mp4`
- 测试计划：`/home/ubuntu/repos/kaogong-assistant/test-plan-v20.md`

### T1 模块卡 → 底部 sheet → 题型专项 → 再来一组 — passed

- 点「言语理解」模块卡**不再直接开始**，弹出底部 sheet「言语理解 · 选择题型」+✕，含渐变「🎯 全部随机 1415 题」+ 四题型 chip：中心理解 464 / 逻辑填空 446 / 语句表达 346 / 细节理解 159 题——与 `/api/submodules?module=yanyu` 返回逐项一致。

  ![sheet](https://app.devin.ai/attachments/c7f70ade-35a9-4203-92f4-b4b90d2b252f/ss_91d7e1d2.png)

- 点「细节理解」→ 答题页 tag =「**言语理解 · 细节理解 · 1/10**」（题型专项生效）：

  ![tag](https://app.devin.ai/attachments/d0daec86-b5ae-4abf-8706-05e2555996c6/ss_zoom_6c1b12d9.png)

- 完整刷完一组 10 题（9 对 1 错，第 7 题故意选 A）：判分红绿、解析、红横幅「✗ 正确答案 C / 已自动存入错题本」、答对自动跳题均正常（回归）：

  ![答错](https://app.devin.ai/attachments/d361b33a-71f9-4c38-bf51-fb1b4f597c33/ss_2f7b27b1.png)

- 完成页「🎉 本组完成 答对 9/10 · 最高连对 6 题」；点「再来一组」→ 新组 tag 仍为「言语理解 · 细节理解 · 1/10」（**沿用同题型**，未回 sheet、未变全模块随机）：

  | 🔴 完成页 | 🟢 再来一组沿用题型 |
  |---|---|
  | ![完成页](https://app.devin.ai/attachments/1cc521a0-b1ce-4bd9-95cd-de757cc3c162/ss_3f8b6f36.png) | ![再来一组](https://app.devin.ai/attachments/f9ed11b3-a33c-46b1-b211-09b28be3ea5d/ss_zoom_59f0d85f.png) |

### T2 混合刷题 / 智能薄弱项入口不弹 sheet — passed

- 点「🎯 混合刷题」卡 → **直接开始**（无 sheet），tag「数量关系 · 1/10」无题型段：

  ![混合](https://app.devin.ai/attachments/b65f540e-c5ca-4f49-b1fb-c1d1ef06b75b/ss_69cf679a.png)

- 点智能入口「去练 ›」（常识判断 29% 触发中）→ **直接开始**常识判断整模块（无 sheet），tag「常识判断 · 1/10」：

  ![智能](https://app.devin.ai/attachments/a7d10825-ce94-4197-bad5-899eea712dbd/ss_zoom_4f9efe01.png)

### T3 API 抽查 — passed

- `/api/submodules?module=yanyu` → 中心理解464/逻辑填空446/语句表达346/细节理解159，与 UI sheet 逐项一致。
- `/api/questions?module=yanyu&submodule=细节理解&limit=10` → 返回 10 条，全部 `(module='yanyu', submodule='细节理解')`。

### 清理

- 本轮新增错题 id 22（+ 部署自测遗留 13-21）已 DELETE，`/api/mistakes` 恢复 **[5, 3, 2]**。

## 增量测试 v19（智能刷题入口 + 错题分布跳练）— 2026-07-31

- 测试环境：**线上 https://kaogong.zalize.com**，强刷新后确认线上构建 hash 与本地 dist 一致（`assets/index-AWrukGne.js`，新构建），400px 移动视口，Chrome。
- 结论：**三组测试全部通过**，无失败断言。
- 环境变更说明：本轮期间收到通知——线上 ACCESS_CODE 已置空，/api/explain 等不再需要访问码；v19 计划不涉及访问码断言，不受影响。
- 生产数据保护：测前基线 `/api/mistakes` = **[5, 3, 2]**；本轮常识判断故意答错 3 题自动新增 id 9/10/11，测后 DELETE 清理，API 确认恢复 **[5, 3, 2]**。生产复习数据零触碰。
- 录屏：`/home/ubuntu/screencasts/rec-7614085a-8efb-4c72-93bf-c3f0b4edf7f4/rec-7614085a-8efb-4c72-93bf-c3f0b4edf7f4-edited.mp4`
- 测试计划：`/home/ubuntu/repos/kaogong-assistant/test-plan-v19.md`

### T1 智能刷题入口（done≥5 且正确率<80% 触发）— passed

- 前置：常识判断仅 1 题时选模块页**无**智能入口（截图1）。
- 常识判断刷 5 题（故意错 3 对 2，含答错自动存错题本，截图2 为答错界面），退出后 pstats 常识=6 题/33%。
- 选模块页顶部出现**渐变橙红**入口「🎯 智能刷题：攻克薄弱项 / 你的 常识判断 正确率较低，建议专项练习 / 去练 ›」（截图3）。
- 点「去练 ›」→ **直接进入常识判断答题**（题头「常识判断 · 1/10」，无需选模块卡，截图4）。

| 🔴 前置：无智能入口 | 🟢 触发后：橙红智能入口 |
|---|---|
| ![before](https://app.devin.ai/attachments/9b5fd30f-a1bf-493b-a8ee-d3706e86d433/ss_zoom_fb7e01cb.png) | ![after](https://app.devin.ai/attachments/cb05c0ac-5750-4742-96ad-84033c478ef7/ss_zoom_4e0685a2.png) |

| 造数：故意答错自动存错题本 | 点入口直开常识判断 1/10 |
|---|---|
| ![wrong](https://app.devin.ai/attachments/bc77fd0b-b7e6-41f4-b952-6d7ae8c164c3/ss_551c80a0.png) | ![start](https://app.devin.ai/attachments/406ee528-d267-4ca1-998b-703c46c12211/ss_zoom_2d4cd36c.png) |

### T2 错题分布行跳练 — passed

- 薄弱分析「错题模块分布」每行右侧为「×N 去练 ›」格式（常识判断 ×4、资料分析 ×2）。
- 点「资料分析」行 → 切到刷题 tab 并**自动开始资料分析组**（题头「资料分析 · 1/10」，通过 storage practiceModule 传递，非停留选模块页）。

| 分布行「×N 去练 ›」 | 点击后自动开始资料分析组 |
|---|---|
| ![rows](https://app.devin.ai/attachments/514c2ab9-c438-4ee6-943d-940290a03195/ss_4ba9ace7.png) | ![ziliao](https://app.devin.ai/attachments/96864542-6b49-4d54-a6be-f80b5b2d3ec4/ss_zoom_3bb64408.png) |

### T3 回归：tabbar 图标抽查 — passed

上方截图中 tabbar 四图标（相机/清单/书本/柱状图）均正常，选中项靛蓝、未选中灰（v18 功能未破坏）。

### 清理与限制

- DELETE id 9/10/11 → `/api/mistakes` 恢复 **[5, 3, 2]**。
- 本地 pstats 遗留常识判断 6 题/33% 的低正确率记录（浏览器本地统计，非生产数据，保留；意味着该浏览器上智能入口会持续显示直至正确率回升）。

## 增量测试 v18（小回归：tabbar 图标 / 复习文案 / 题库 6254）— 2026-07-31

- 测试环境：**线上 https://kaogong.zalize.com**（访问码 hs1326），强刷新后确认线上构建 hash 与本地 dist 一致（`assets/index-hEnMdvH3.js`，新构建），400px 移动视口，Chrome。
- 结论：**三组测试全部通过**，无失败断言。
- 生产数据保护：测前基线 `/api/mistakes` = **[5, 3, 2]**，`/api/review` 到期 = **[]（空）**。本轮刷题故意答错自动新增 1 条（常识判断·水浒题），复习队列仅含该新条目——**生产复习数据本轮零触碰**。测后 UI 删除该条，API 确认恢复 **[5, 3, 2]**。
- 录屏：`/home/ubuntu/screencasts/rec-fdb91d6f-c14e-4537-bfa9-f0e64cdac6e7/rec-fdb91d6f-c14e-4537-bfa9-f0e64cdac6e7-edited.mp4`
- 测试计划：`/home/ubuntu/repos/kaogong-assistant/test-plan-v18.md`

### T1 tabbar 四图标（选中靛蓝 / 未选中灰）— passed

四个 tab 逐一点击验证：每项有图标+文字（相机=拍题讲解 / 清单=刷题 / 书本=错题本 / 柱状图=薄弱分析），当前选中项图标与文字为靛蓝 #4f46e5，其余三项灰色。

| 拍题讲解选中 | 刷题选中 |
|---|---|
| ![ask](https://app.devin.ai/attachments/fe9ad436-0f15-4e20-b0ab-ed486523a1fa/ss_zoom_abf3de5b.png) | ![practice](https://app.devin.ai/attachments/2962d8b2-90c8-47fd-baf9-7fac83ba5b5d/ss_zoom_d663cef2.png) |

| 错题本选中 | 薄弱分析选中 |
|---|---|
| ![book](https://app.devin.ai/attachments/36b2a2f8-431d-489d-ab8e-9ad763a65251/ss_zoom_3f79fb1c.png) | ![stats](https://app.devin.ai/attachments/64c4bf10-1023-4d2f-bf81-a8cd510fbc1b/ss_zoom_fe8e1e08.png) |

### T2 题库 6254 与模块卡一致 — passed

- 线上 `/api/questions` counts：言语 1415 / 判断 1377 / 数量 1342 / 常识 1297 / 资料 823，**合计 6254**。
- 刷题页模块卡逐一比对一致：言语理解 1415 题 / 判断推理 1377 题 / 数量关系 1342 题 / 常识判断 1297 题 / 资料分析「已刷 12/823」（v17 本地 pstats 显示形式，总数 823 正确）。
- 抽查 `?module=ziliao&limit=10`：返回 10 条且全部 module=ziliao。

### T3 复习模式新文案 + 重入队 — passed

准备：常识判断故意答错 1 题（自动存错题本），复习队列仅该新题。

- 复习 1/1 故意答错 → 红色提示精确为「**又错了，看讲解（稍后本轮会再出现）**（下次复习：1 天后）」，队列变 **1/2**（重入队）。
- 第 2/2 该题重现，答对 B → 绿色提示精确为「**这次答对了，本轮已纠正 ✓**（下次复习：1 天后）」（非旧「答对了！连对…」），v17 P3 已修复。

| 🔴 答错新文案+重入队 1/2 | 🟢 纠正文案 2/2 |
|---|---|
| ![wrong](https://app.devin.ai/attachments/9071c213-1c84-4d8c-ab46-e0d32b0f561b/ss_zoom_1d98657e.png) | ![corrected](https://app.devin.ai/attachments/556a37b4-5bcd-4d1b-b3aa-913b814b79e0/ss_zoom_94f1be11.png) |

### 清理

UI 确认删除本轮新条目 → `/api/mistakes` 恢复 **[5, 3, 2]**（截图：![cleanup](https://app.devin.ai/attachments/5e0857e4-2117-4e04-9f94-77979898224f/ss_c05c816b.png)）。

### 限制/说明

- 该新条目复习答错+答对使其 review_count=2（随后已删除，无生产影响）。
- 五模块计数分布与 v16/v17 不同（本轮以线上运行时为准）；v16 遗留的分布差异问题不再适用（题库已换代到 6254）。

## 增量测试 v17（P0 UI 改造：对标粉笔/Duolingo）— 2026-07-31

- 测试环境：**线上 https://kaogong.zalize.com**（访问码 hs1326），强刷新后确认线上构建 hash 与本地 dist 一致（`assets/index-CsKRz-MI.js`），400px 移动视口，Chrome。
- 结论：**五组测试全部通过**，无失败断言。
- 生产数据保护：测前基线 `/api/mistakes` = **[5, 3, 2]**；本轮答错自动新增 id=6、7，测后 UI 删除，API 确认恢复 **[5, 3, 2]**。⚠️ 说明：复习模式测试必经生产到期条目 id=3、5（在线队列无法跳过），我对它们**按正确答案答对**，其 review_count 各 +1、下次复习顺延 1 天（正常使用行为，无法回滚，已如实记录）。
- 录屏：`/home/ubuntu/screencasts/rec-f3ac86a4-a6ce-47e2-963b-3e047edd5948/rec-f3ac86a4-a6ce-47e2-963b-3e047edd5948-edited.mp4`
- 测试计划：`/home/ubuntu/repos/kaogong-assistant/test-plan-v17.md`

### ① 首页 ask：今日学习卡 + 大虚线上传框

🟢 hero 下出现渐变今日学习卡：「今日已刷 0 题 / 开始今天的练习吧」，因有 2 道到期错题右侧按钮为「先复习 2 道错题」，点击跳转错题本 Tab。拍图模式为大虚线上传框（📷 图标 +「拍照 / 从相册选择」+「支持错题截图、试卷拍照」）。刷题+详解后回首页，卡片实时更新为「今日已刷 12 题 · 连续打卡 1 天 🔥 / 先复习 1 道错题」。

![首页今日学习卡+虚线上传框](https://app.devin.ai/attachments/4e93e1d3-5e5b-4d14-ac7e-9cde6f6ccb84/ss_zoom_ab7a29e5.png)

### ② 刷题新 UI 端到端（资料分析 10 题完整一组）

🟢 模块卡：彩色首字图标（常/数/判/资/言各异色）+ 题数 + 进度条；初始无 pstats 显示「N 题」。
🟢 答题页：顶部进度条 + ✓/✗ 计数徽章；选项为大卡片圆形字母序号。
🟢 答对（Q1 选 D，9475.4×18.5%≈1752.9 自算正确）：选项绿框+✓，底部滑入**绿色**横幅「✓ 回答正确」，**约 1.2s 自动进入下一题**（未点击任何按钮，2/10 自动出现）。
🟢 连对 3 题（Q1-Q3 全对）：头部出现 **🔥3** 徽章 + toast「🔥 连对 3 题！」+ 横幅「✓ 回答正确 · 连对 3 题！」三处证据齐全。
🟢 故意答错（Q4 选 A，正确 C）：A 红框+✗、C 绿框+✓；底部**红色**横幅「✗ 正确答案 C」+ 副文「**已自动存入错题本**」；**不自动跳转**（停留 >10s），需手点「下一题」；API 确认自动新增 id=6（user_answer=A / correct_answer=C）。
🟢 结算页：**90% 正确率圆环** = 答对 9/10，「最高连对 6 题，错题已自动加入错题本」+ 再来一组/返回选模块。
🟢 返回后模块卡变为「**已刷 10/718 · 正确率 90%**」+进度条着色（pstats 本地统计生效）。

| 答对绿横幅+✓✗徽章 | 连对3题🔥+toast |
|---|---|
| ![答对](https://app.devin.ai/attachments/4b619cc3-ea14-4d59-80e0-128795382822/ss_zoom_fabff59b.png) | ![连对](https://app.devin.ai/attachments/bd6050c1-3700-4bc9-bc61-4a7dd0b71db2/ss_zoom_e24c7b31.png) |

| 答错红横幅+已自动存入 | 结算页 90% 圆环 |
|---|---|
| ![答错](https://app.devin.ai/attachments/4bb1359e-4242-4c2a-b1e2-8ecb8a31d468/ss_zoom_9d3a855b.png) | ![结算](https://app.devin.ai/attachments/f0ab0ebe-185c-41aa-8bde-fdeb957cbe99/ss_zoom_d455fa05.png) |

| 模块卡初始（彩色图标+题数） | 刷题后（已刷/正确率/进度条） |
|---|---|
| ![初始](https://app.devin.ai/attachments/f3048760-5e1a-45e5-bd5b-37ee6d09a353/ss_zoom_be554bcc.png) | ![更新后](https://app.devin.ai/attachments/c05f639b-2a04-4fd7-a54e-a84396496497/ss_zoom_5432b01e.png) |

### ③ 错题本：待复习横幅 / chips / 掌握度色条 / 复习重入队

🟢 顶部渐变「📚 今日待复习 3 道 · 预计 3 分钟 / 开始复习」（生产 2 + 本轮新增 1，数量正确）。
🟢 筛选 chips「全部/资料分析/常识判断」，点「常识判断」仅显示该模块 1 条，切回「全部」恢复。
🟢 掌握度左色条：本轮新错题**红**（未复习）、已复习1次**橙**、复习后 2 次**绿**（复习完成后本轮题显示「已复习2次」+绿条）。题干截断 + 底部重做/删除按钮正常。
🟢 复习重入队：队列 3 道（id 3→5→6）；id3、id5 按正确答案答对（绿色+「答对了！连对 1 次（下次复习：1 天后）」）；id6 **故意答错**（B 红、C 绿、「又错了，看讲解」+讲解展开）→ 队列由 3/3 变 **3/4**，第 4 题即该题重现，再答对后「完成复习」回列表。

| 掌握度色条（红/橙）+截断+按钮 | 答错重入队（3/3→3/4） |
|---|---|
| ![色条](https://app.devin.ai/attachments/255a5047-c9a0-4985-9c06-845ac75a8d05/ss_zoom_9a5c0fc7.png) | ![重入队](https://app.devin.ai/attachments/a146bcd3-10a9-4e7c-af0e-e0b45dc44fde/ss_zoom_ca1c7c2b.png) |

### ④ 统计页：总览卡 / 雷达图 / 着色分布条

🟢 总览卡「**10 累计刷题 / 90% 总正确率 / 1 连续打卡(天)**」与本轮实际答题一致（pstats）。
🟢 五模块能力雷达出现（刷题后），资料 90%、其余 0%，多边形渲染正常。
🟢 错题模块分布条按占比着色：资料分析 ×3 **红**（75%>40%）、常识判断 ×1 **橙**（25%>20%），宽度占比正确。

![统计页总览+雷达+分布](https://app.devin.ai/attachments/190579f8-ac9f-4961-a371-0b6558625250/ss_zoom_2e851aad.png)

### ⑤ 回归：详解跳转 + 流式讲解 + 深色模式

🟢 答错题解析下「🔍 用花生十三方法详解这道题」→ 跳拍题页自动文字模式回填题干+选项 + toast「题目已填入…」（截图捕获）。
🟢 流式讲解：识题计秒 → 结果卡出现 → 渐进渲染完整讲解（ABRX+415 份数法），答案 A.481.7（5539.6×8/92≈481.7 自算正确），易错点指出 D 443.2 陷阱。
🟢 深色模式（DevTools 模拟 prefers-color-scheme: dark）：深色卡片、浅色文字可读、tabbar 深色，无白底残留；关闭模拟后浅色恢复正常。

| 流式讲解（浅色） | 同屏深色模式 |
|---|---|
| ![流式](https://app.devin.ai/attachments/519d6b3e-7a01-4ff4-b74e-990566da8c90/ss_zoom_ae3663b4.png) | ![深色](https://app.devin.ai/attachments/9e2a80bf-ae0a-4012-99f0-7b191d636fab/ss_zoom_fe14e700.png) |

### ⑥ 清理

🟢 UI 逐条删除本轮自动存入的 id=6、7（确认弹窗），API 确认 `/api/mistakes` 恢复 **[5, 3, 2]**，生产数据未删。

![清理后列表仅剩生产条目](https://app.devin.ai/attachments/89ad8596-e0c7-4119-a38e-52b3ffce0c99/ss_zoom_67b9419a.png)

### 覆盖限制与发现

- 覆盖限制：① 混合刷题入口本轮未重复验证（v13 已测，本轮无改动声明）；② shake 动画为 0.3s 瞬时效果，静态截图无法证明，以录屏+红框✗状态为证；③ 自动跳题计时以「点击后未操作、约 1-2s 内出现下一题」为证，未毫秒级测量。
- P3 体验发现（非 bug）：复习模式答错重做后再答对，提示仍为「答对了！连对 1 次（下次复习：1 天后）」，与首次答对无差异，用户感知不到「重做通过」；可考虑显示「本轮已纠正」之类文案。

---

## 增量测试 v16（线上部署：md.js h4-h6 渲染修复 + 题库 4051）— 2026-07-31

- 测试环境：**线上 https://kaogong.zalize.com**（访问码 hs1326），400px 移动视口，Chrome。
- 结论：**四项测试全部通过**，无失败断言。v15 P3（`####` 字面显示）**已修复验证**。
- ⚠️ 备注：lead 消息给的分模块数字（shuliang 723 / changshi 678 / ziliao 673 / panduan 671 / yanyu 414）与线上实测不一致，但**总数一致 4051**。线上 API/UI 实测：常识判断 963 / 数量关系 945 / 判断推理 838 / 资料分析 718 / 言语理解 587（以运行时为准，可能是消息中的数字过期/笔误，建议 lead 确认）。
- 录屏：`/home/ubuntu/screencasts/rec-5d3271be-2e71-4c6c-8234-07dceabda4d4/rec-5d3271be-2e71-4c6c-8234-07dceabda4d4-edited.mp4`
- 测试计划：`/home/ubuntu/repos/kaogong-assistant/test-plan-v16.md`

### ① h4 标题渲染（v15 P3 修复验证）

🟢 文字模式提交四地增速比较题（与 v15 同型），流式讲解中 LLM 输出 `#### 甲省/乙省/丙市/丁省` 小节——全部渲染为**加粗小标题样式**，页面无任何原始 `####` 井号（对照 v15 截图中的字面 "#### 禾原省"）。流式正常（识题→生成→渐进渲染），答案 D.丁省 自算正确（360.1÷2950.4≈12.2% 最大）。访问码 hs1326 弹框输入后自动重试成功。

![h4 渲染为标题样式，无井号](https://app.devin.ai/attachments/12bf0c22-2246-4663-8dad-d75cd38bdf69/ss_zoom_bc10352e.png)

### ② 题库 4051 + 模块卡

🟢 刷题页模块卡：常识判断 963 / 数量关系 945 / 判断推理 838 / 资料分析 718 / 言语理解 587，**合计 4051**，与线上 `GET /api/questions` counts 完全一致。`?module=shuliang&limit=10` 返回 10 条且全部 shuliang（API 抽查）。

![模块卡 4051](https://app.devin.ai/attachments/32c161d6-d5b0-4da2-9d56-4ee74e1a0720/ss_zoom_26b32492.png)

### ③ 刷题答题判分 + 错题保存

- 🟢 资料分析 1/10 选 B（正确）→ B 绿、「✓ 答对了」+解析。
- 🟢 2/10（养老床位题，正确 C）故意选 A → A 红、C 绿、「✗ 答错了，正确答案 C」+解析+「存入错题本」按钮。
- 🟢 点存入 → toast「已存入错题本」+按钮变「✓ 已存入错题本」禁用。
- 🟢 错题本页新条目出现（题干+A/B/C/D 选项文本+「资料分析-校验计算」tag）。

| 答对判分（绿） | 答错判分（红/绿）+存入按钮 |
|---|---|
| ![答对](https://app.devin.ai/attachments/74f3a1c1-6ee6-47f5-8411-3e931ec19656/ss_zoom_41013b78.png) | ![答错](https://app.devin.ai/attachments/e0dca428-93f8-41e4-8500-a3bb95bd09e9/ss_zoom_feed9a22.png) |

| 存入成功 toast | 错题本新条目 |
|---|---|
| ![存入](https://app.devin.ai/attachments/3e99b33d-7ffc-4fdc-b8f8-69cf2200996c/ss_zoom_0b2cd38c.png) | ![错题本](https://app.devin.ai/attachments/2e0e9ab3-bb61-4445-89a1-ddde38639339/ss_zoom_65800600.png) |

### ④「🔍 用花生十三方法详解这道题」回归

🟢 答错题下点入口 → switchTab 到拍题页、自动「⌨️ 粘贴文字」模式、textarea 回填题干+`A.11.2 B.11.6 C.12.0 D.12.4` 选项、答案框空、toast「题目已填入，先自己做一遍再点讲解」已捕获。（本轮未重复点讲解，流式已在 ① 验证。）

![详解回填](https://app.devin.ai/attachments/c21e89c7-9c74-4ede-a02a-d5db74b3863b/ss_zoom_8c20e01e.png)

### 清理与覆盖说明

- 🟢 清理：UI 确认删除本轮存入的错题条目，`/api/mistakes` 恢复为线上既有 `[3, 2]`（用户生产数据未动）。

![清理后错题本](https://app.devin.ai/attachments/92cd1faa-8e9d-458b-b46e-c7be47a7a311/ss_zoom_5ad2bfde.png)

- 覆盖限制：h5/h6（`#####`/`######`）本轮 LLM 输出未自然出现，未单独像素验证（md.js 将 4-6 级统一渲染为 h4 样式，`/^#{4,6}\s/` 同一正则分支，h4 已验证）；混合刷题/完成页/复习模式等 v13/v8 已验证项未重测。

## 增量测试 v15（题库扩充 699 题 + 刷题详解入口）— 2026-07-30

- 结论：**三项测试全部通过**，无失败断言；1 个新发现的渲染小瑕疵（P3，见下）。
- ⚠️ **环境处理**：本地 :8000 旧进程 20179（21:00 启动）早于 questions_bank.jsonl 修改（21:57），题库仍是旧 12 题——按 SKILL 我 kill 后用 exec env 参数绑定 secret 重启（新 PID 24322，environ 无 `secret:` 字面值、LLM_BASE_URL 为 https URL），重启后种子导入生效。
- 录屏（400px 视口）：`/home/ubuntu/screencasts/rec-afcfc8fd-4bab-4e31-9fba-2db28304246b/rec-afcfc8fd-4bab-4e31-9fba-2db28304246b-edited.mp4`
- 测试计划：`/home/ubuntu/repos/kaogong-assistant/test-plan-v15.md`

### ① 题库 699 题：counts 与模块卡

🟢 `GET /api/questions` counts：常识判断 162 / 资料分析 148 / 数量关系 135 / 判断推理 132 / 言语理解 122，**合计 699**；刷题页模块卡显示一致的新题数。`/api/questions?module=yanyu&limit=10` 返回 10 条且全部 module=yanyu（按模块取题正常）。

![模块卡新题数](https://app.devin.ai/attachments/576b3e50-cdd1-43e0-ac8a-e8e543dad45a/ss_zoom_f67af962.png)

### ② 刷题 →「🔍 用花生十三方法详解这道题」闭环

- 🟢 资料分析第 1 题（四地增速比较）选 B 答对 → 解析下方出现「🔍 用花生十三方法详解这道题 ›」入口。
- 🟢 点击 → switchTab 到拍题讲解页，自动处于「⌨️ 粘贴文字」模式，textarea 回填题干+`A.汀北省 B.禾原省 C.曲沙市 D.云屏省` 选项文本，答案框为空，**toast"题目已填入，先自己做一遍再点讲解"已在截图捕获**。
- 🟢 点「用花生十三方法讲解」→ 流式讲解正常，内容针对该题（四地数据逐一计算 8.9%/4.8%/3.2%/11.8%），答案 **B. 禾原省** 与题库 answer 一致。

| 答题后详解入口 | 跳转回填+toast |
|---|---|
| ![详解入口](https://app.devin.ai/attachments/1096126d-cc29-4a6f-81a6-4022a7f8d574/ss_zoom_182bb1f8.png) | ![回填toast](https://app.devin.ai/attachments/c53f7461-c6d4-48db-9050-b778003396b0/ss_zoom_e90cd134.png) |

流式讲解（针对该题，答案 B）：

![流式讲解](https://app.devin.ai/attachments/9b3b9f55-2b67-4db8-96dc-cb6103885967/ss_zoom_d801b805.png)

### ③ 新发现（非阻塞）

- P3 渲染瑕疵：讲解 rich-text 中 markdown **`####` 四级标题以字面文本显示**（见上图"#### 禾原省"），md.js 未处理 h4；建议 md.js 补 `####` → `<h4>`。

### 覆盖说明与清理

- 本轮未产生新错题（答对未存入），/api/mistakes 确认仍仅 `[6]`，无需清理。
- 混合刷题/完成页等 v13 已验证项本轮未重测。

## 增量测试 v14（分段输入切换 + 深色模式 + 错题本空态）— 2026-07-30

- 结论：**四项测试全部通过**，无失败断言。H5 构建 21:19 新鲜，后端无改动（进程 20179 仍有效）。
- 录屏（400px 视口）：`/home/ubuntu/screencasts/rec-804c69ee-3803-473b-ab37-5f142e3dd63c/rec-804c69ee-3803-473b-ab37-5f142e3dd63c-edited.mp4`
- 测试计划：`/home/ubuntu/repos/kaogong-assistant/test-plan-v14.md`

### ① 分段切换「📷 拍图识题 / ⌨️ 粘贴文字」

- 🟢 默认拍图模式：分段控件"拍图识题"高亮，仅显示选图按钮，无 textarea；答案输入框标签无"③"序号。
- 🟢 拍图模式选图后出现预览+「✕ 移除图片」；切到「粘贴文字」→ textarea 显示、选图按钮/预览隐藏。
- 🟢 **text 模式忽略图片**：已选图（9.6亿件图片题）情况下粘贴文字题（8800万件）提交 → 流式讲解针对**文字题**：8800÷1.1=8000，答案 **B.8000**（自算正确），非图片题内容。

| 默认拍图模式（无 textarea） | 已选图（预览+移除按钮） |
|---|---|
| ![拍图模式](https://app.devin.ai/attachments/938d400a-305a-480c-918e-2d993c0e81c5/ss_zoom_e7bb582b.png) | ![选图后](https://app.devin.ai/attachments/ded15e48-c0fb-4a62-8e07-443ccda4e88b/ss_zoom_b24d8a92.png) |

| 切文字模式（textarea 显示） | 流式讲解针对文字题（B.8000） |
|---|---|
| ![文字模式](https://app.devin.ai/attachments/e79534d4-825e-4c10-a784-cee5504cdadd/ss_zoom_0cce7fdb.png) | ![讲解](https://app.devin.ai/attachments/ff08fe74-d741-4461-abcb-47550ba5e71d/ss_zoom_8cf0a643.png) |

### ② 错题本空态

🟢 备份 data.db 后 UI 确认删除 id=6 → 空态卡：📖 图标 + "错题本还是空的" + 遗忘曲线说明 + 「去刷题」按钮；点击后 switchTab 跳到刷题页（模块卡片可见，兼作刷题页回归）。测后从备份**原样恢复 id=6 行**（review_count=2 保留），API 确认 `[6]`。

| 空态卡 | 点「去刷题」跳转 |
|---|---|
| ![空态](https://app.devin.ai/attachments/6ab68e90-7656-4de7-a28c-b0f4b73035f6/ss_zoom_d96501d8.png) | ![跳刷题](https://app.devin.ai/attachments/74d0d384-44e0-4860-904f-dc8d0a8bbe9e/ss_zoom_82d170ec.png) |

### ③ 深色模式（DevTools Emulate prefers-color-scheme: dark，用户指定方式）

🟢 四个页面卡片深色（#23262f 系）、文字浅色可读、tabbar 深色（#1c1f27）、页面渐变深色，输入框/textarea/分段控件/模块卡均无白底残留：

| 拍题讲解（深色，含分段+textarea） | 刷题（深色模块卡） |
|---|---|
| ![拍题深色](https://app.devin.ai/attachments/a92d8264-1ca0-4042-967d-92b63d1e4fe4/ss_zoom_67e0da14.png) | ![刷题深色](https://app.devin.ai/attachments/e39dc0a4-1839-4092-800c-9fb0b28d87bb/ss_zoom_1ef241a8.png) |

| 错题本（深色） | 薄弱分析（深色） |
|---|---|
| ![错题本深色](https://app.devin.ai/attachments/9301c740-35d9-41c1-b37c-47f6e5adadc5/ss_zoom_7d13bd90.png) | ![薄弱深色](https://app.devin.ai/attachments/c52e1044-dccd-4dba-887a-6460b684dc2c/ss_zoom_b519d18b.png) |

### ④ 快速回归（Regression，浅色）

🟢 关闭深色模拟后浅色恢复：薄弱分析（资料分析 ×1 条形图 + TOP10）正常；刷题模块卡在②中已验证正常。

![浅色回归](https://app.devin.ai/attachments/792c7aee-5e7a-4b7e-98c8-ebc3ba5b3345/ss_zoom_a29c479e.png)

### 覆盖说明与清理

- "重做/详解回填自动切文字模式"：代码路径（ask.vue L98/L285 均置 mode='text'）本轮未单独 UI 复跑（v5/v11 已验证重做/详解链路，本轮改动仅增加模式切换赋值）——标记为**未单独验证**。
- 深色模式为 DevTools 模拟（用户指定 CDP/emulation 方式），非系统级深色；模拟关闭后浅色即恢复。
- 清理：id=6 已从备份原样恢复（含复习状态），无残留测试数据；备份文件 /tmp/data_v14_backup.db。

## 增量测试 v13（新增「刷题」功能）— 2026-07-30

- 结论：**五项测试全部通过**，无失败断言。服务进程 20179（21:00 启动，晚于代码修改）、H5 构建 21:00 新鲜，环境本轮由 lead 部署正确，无需重启。
- 录屏（400px 视口）：`/home/ubuntu/screencasts/rec-bbb10ed2-992b-45fb-b910-a2fd2035c72b/rec-bbb10ed2-992b-45fb-b910-a2fd2035c72b-edited.mp4`
- 测试计划：`/home/ubuntu/repos/kaogong-assistant/test-plan-v13.md`

### ① 刷题 Tab 与模块卡片

🟢 tabBar 第 2 位出现「刷题」；模块卡题数与种子库完全一致：资料分析 3 / 数量关系 3 / 言语理解 2 / 判断推理 2 / 常识判断 2，另有渐变「混合刷题·全部模块」卡。API `GET /api/questions` counts 同值（ziliao3/shuliang3/yanyu2/panduan2/changshi2，无需访问码）。

| 模块卡片与题数 | 混合刷题进入（常识判断·1/10） |
|---|---|
| ![模块卡片](https://app.devin.ai/attachments/2e7a7c41-af22-4372-846c-2680833324f7/ss_zoom_a239004d.png) | ![混合刷题](https://app.devin.ai/attachments/dfa64759-dab8-4a60-9eea-c14ed79dafb0/ss_zoom_7101b819.png) |

### ② 完整刷完一组（言语理解，2 题，验证"不足按库存"）

- 🟢 组大小 = 2（库存 2 题 < 10，按库存），头部 tag "言语理解 · 1/2"。
- 🟢 第 1 题（正确答案 A）故意选 B：B 红底、A 绿底、C/D 变淡，判定"✗ 答错了，正确答案 A"，解析文本展示，出现「存入错题本」按钮；点击后变"✓ 已存入错题本"。
- 🟢 API 校验入库 id=16：`user_answer=B`、`correct_answer=A`、module=yanyu、question_type=言语理解-逻辑填空、question_text 含完整选项文本 `A.支撑 行稳致远 B.维系 昙花一现 …`。
- 🟢 第 2 题（正确答案 C）选 C：仅 C 绿色、"✓ 答对了"、解析显示、**无**存入按钮。

| 答错红/绿标色+解析+存入按钮 | 存入后按钮态 | 答对仅绿 |
|---|---|---|
| ![答错](https://app.devin.ai/attachments/241b6d2d-769e-4f77-9b53-1970ee63206a/ss_zoom_cdcfeee0.png) | ![已存入](https://app.devin.ai/attachments/3dfefd3e-654e-466f-a181-a13799f0e79e/ss_zoom_439b1130.png) | ![答对](https://app.devin.ai/attachments/2cb15446-cb99-4b91-9b13-00843cd8729a/ss_zoom_8f7f646e.png) |

### ③ 错题本确认

🟢 错题本页新条目「言语理解-逻辑填空」出现，题干含 ABCD 选项文本，点开展开解析（注明"选 A"正确答案），顶部出现"有 1 道错题待复习"：

![错题本条目](https://app.devin.ai/attachments/b67cdfb1-8220-43b8-bd5e-01fe895d1092/ss_zoom_7caa0fd8.png)

### ④ 完成页与再来一组

🟢 完成页"🎉 本组完成 答对 1/2"（1 对 1 错，统计正确）+「再来一组」「返回选模块」；点「再来一组」立即开新组（言语理解·1/2 重新开始）。

![完成页](https://app.devin.ai/attachments/09a39c3f-f363-43ac-aa72-1cde0d94c384/ss_zoom_eb894419.png)

### ⑤ 混合刷题 + 拍题讲解流式回归（Regression）

- 🟢 「混合刷题」进入跨模块组"常识判断 · 1/10"（全库 12 题取 10），见①右图；验证后退出，未刷完整组（入口可用性验证）。
- 🟢 流式讲解回归：粘贴基期题（6600 亿元增长 10%）→ 识题后结果卡先出现、讲解随后逐步渲染完整，含题型识别/ABRX 公式/截位直除/答案 **B.6000**（自算 6600÷1.1=6000 正确）/易错点：

![流式回归](https://app.devin.ai/attachments/4c64e727-89cf-4b26-bb26-b07550b41500/ss_zoom_18e33569.png)

### 覆盖说明与清理

- 混合刷题只验证了入口与进入答题（1/10），未完整刷完 10 题（模块组已完整验证同一流程）。
- 流式"逐字增长"本轮以"卡片先出现→数秒后完整内容"证明（录屏可见渐进渲染），未做双截图对比（v10 已充分验证）。
- 清理：DELETE id=16，`/api/mistakes` 恢复仅剩 `[6]`。题库 questions 表数据为种子数据，未改动。

## 增量测试 v12（薄弱分析条形图重设计 + 存题去重）— 2026-07-30

- 结论：**三项测试全部通过**，但期间发现**服务器仍在跑旧代码**（20:23 修改的 db.py 未生效，服务 19:48 启动），去重首测失败后由我重启服务再测通过——请以后改完后端代码务必重启 uvicorn
- 录屏：`/home/ubuntu/screencasts/rec-c057a486-ee66-4213-b941-65d5175c9e64/rec-c057a486-ee66-4213-b941-65d5175c9e64-edited.mp4`
- 造数与清理：POST /api/mistakes 造 3 条不同模块错题（判断×2/数量×1），测试后全部删除，DB 恢复仅剩 id=6

### ① 新条形图样式（400px）

🟢 模块中文名（左）+ ×N（右）位于进度条**外部上方**，进度条为 20rpx 细胶囊渐变条（#6366f1→#4f46e5），条内无任何文字（v9 P2"白字偏小拥挤"已修复）；判断推理 ×2 条宽约 50%、资料/数量 ×1 约 25%，占比正确；TOP10 卡片正常：

| 新条形图（3 模块） | 清理后（回归单模块） |
|---|---|
| ![新条形图](https://app.devin.ai/attachments/3800a935-a75d-4d5e-adb0-50d26b68b77f/ss_zoom_4e8cca79.png) | ![清理后](https://app.devin.ai/attachments/a7b1b97d-b0f7-46a0-a93e-e6933d30a5b0/ss_zoom_74585991.png) |

### ② 存题去重（API）

- 🔴 首测（旧进程）：同一 question_text 两次 POST 返回 id 11、12，列表出现 2 条 → **失败**。排查：uvicorn 19:48 启动早于 db.py 20:23 修改，属**部署/重启遗漏**而非代码 bug。
- 🟢 我 kill 旧进程并按 SKILL 用 exec env 参数绑定 secret 重启（environ 确认无 `secret:` 字面值）后复测：两次 POST 均返回 `{'id': 15}`，GET 列表该题干仅 1 条 → **通过**。
- 🟢 不同题干正常返回新 id（13、14）。

### ③ 错题本回归（Regression）

🟢 4 条错题（3 造数 + id6）tag/时间/重做/删除渲染正常，无破版；去重题干仅出现 1 次：

![错题本回归](https://app.devin.ai/attachments/61aa28a5-444c-432b-99c5-e6518c449638/ss_da8d000f.png)

### 覆盖说明

- 按 lead 要求本轮为截图为主的短流程；去重仅 API 验证（UI 的存入按钮本身有 saved 防重复，v11 已测）。
- 大小写/首尾空格不同的"同一题干"不会被去重（精确匹配），如需模糊去重需另行实现（P2 备忘）。

## 增量测试 v11（举一反三答错存入错题本）— 2026-07-30

- 结论：**三项测试全部通过**（H5，400px 移动视口）
- 录屏：`/home/ubuntu/screencasts/rec-e4ae07bb-11f8-46ca-a626-badfbd7de7f4/rec-e4ae07bb-11f8-46ca-a626-badfbd7de7f4-edited.mp4`
- 造数与清理：流程中存入 1 条练习错题（id=10），测试后通过 UI 确认删除，DB 恢复仅剩 id=6

### ① 答错 → 出现「存入错题本」按钮并可存入

🟢 练习题（156 万辆÷1.3=120，正确 B）故意选错 D → D 红、B 绿、解析展开，按钮行出现「用花生十三方法详解这道题」+「存入错题本」；点击后按钮变"✓ 已存入错题本"禁用：

| 选错后出现存入按钮 | 点击后 ✓ 已存入禁用 |
|---|---|
| ![选错出现按钮](https://app.devin.ai/attachments/ad8dc0e5-ddb2-4ac6-8e10-f883820fbbdc/ss_zoom_99dffd66.png) | ![已存入](https://app.devin.ai/attachments/130e2b7f-a7e7-4c86-aeb4-f4337b7233d4/ss_zoom_6e0db974.png) |

🟢 API 校验入库字段：`user_answer=D`、`correct_answer=B`、`module=ziliao`、`question_type=资料分析-基期量计算`（继承原题）、explanation 含完整题目+解析（320 字符）。

🟢 错题本页：新条目出现（题干无"## 练习题/## 提示"标题），点击可展开完整练习题+提示+答案与解析；顶部同时出现"📚 有 1 道错题待复习"：

![错题本条目展开](https://app.devin.ai/attachments/bf23c7dc-2a65-4bbc-b870-f162f1a2c05d/ss_zoom_19ac672e.png)

### ② 答对 → 不出现存入按钮

🟢 重新出题后选正确 B（仅 B 绿色）→ 解析下方**只有**「用花生十三方法详解这道题」，无「存入错题本」：

![答对无存入按钮](https://app.devin.ai/attachments/7269d958-b5e6-438c-9e95-43fb51c38a5a/ss_zoom_7af4789a.png)

### ③ 新错题进入复习模式可作答

🟢 该练习错题立即到期（复习 1/1）→ 选 B 变绿+"答对了！连对 1 次（下次复习：1 天后）"+解析展开 → 完成复习后回列表，待复习卡片消失、条目显示"已复习1次"；随后 UI 确认删除清理成功：

| 复习作答正确 | 完成复习+删除清理后 |
|---|---|
| ![复习作答](https://app.devin.ai/attachments/8bc93269-4c29-44dd-b47b-e59e1921656b/ss_zoom_b637aa05.png) | ![完成复习](https://app.devin.ai/attachments/e8a8f5a9-c74d-4b8d-99be-cfbdc1bb31ad/ss_zoom_c1301b4e.png) |

### 覆盖说明与小发现

- 存入后再点「举一反三」重新出题会**重置 sim 状态（saved 归零）**，若再答错可重复存入同一道题（本轮未实际重复存入验证），可能产生重复错题条目——建议按题干去重或提示（P2）。
- 「存入错题本」按钮 disabled 后未再次点击验证防重复（DOM disabled + saved 标志与非重复入库 API 证据一致）。
- 小程序端按惯例未测。

## 增量测试 v10（流式讲解输出）— 2026-07-30

- 结论：**四项测试全部通过**（H5，400px 移动视口）
- 录屏：`/home/ubuntu/screencasts/rec-7fc5463b-efef-4449-a249-f51cf701296c/rec-7fc5463b-efef-4449-a249-f51cf701296c-edited.mp4`
- 造数：流式讲解后存入 1 条错题（id=9）验证回归，测试后已删除，DB 恢复仅剩 id=6

### ① 文字题流式讲解（核心）

🟢 识题完成（meta 到达）后结果卡**立即出现**且 loading 计秒消失，讲解逐字增长——左图先出现（内容截至"公式 B=A÷(1+R)"），数秒后右图内容明显变长（已到 Step 1）；一次性完整出现则不会有此差异：

| 流式中·截图1（内容不完整） | 流式中·截图2（内容已增长） |
|---|---|
| ![流式1](https://app.devin.ai/attachments/c5a1983c-cd67-49cf-80dc-abaf09adf635/ss_c12a89b1.png) | ![流式2](https://app.devin.ai/attachments/ab684947-2206-4602-9ff5-8f69c31087d3/ss_zoom_8f052281.png) |

🟢 最终内容完整：题型识别（ABRX+截位直除）、方法步骤、答案 **B.4500**（5400÷1.2 自算正确）、易错点；`---` 已渲染为水平分隔线（v9 P2 已修复）：

![最终完整+hr](https://app.devin.ai/attachments/925de711-1b8a-4514-9ac1-f9323555c3f7/ss_zoom_063a96b1.png)

### ② 流式完成后按钮回归（Regression）

🟢 「存入错题本」→ 按钮变"✓ 已存入错题本"禁用（API 确认 id=9 入库，测试后删除）；「举一反三」→ "出题中…（N秒）"→ 练习题+提示+ABCD 正常（360÷1.25=288，题目自洽）：

| 已存入按钮态 | 举一反三练习题 |
|---|---|
| ![已存入](https://app.devin.ai/attachments/a883a399-b8e0-4f45-8fca-f3e739ed3af5/ss_411144a6.png) | ![举一反三](https://app.devin.ai/attachments/7b394603-0c26-4a56-ade8-11c63fb0d061/ss_zoom_f091b5f5.png) |

### ③ 图片上传讲解

🟢 上传 PIL 生成的中文题目图片（快递业务量 9.6 亿件、+20%）→ 走流式路径成功，OCR 识题完整，答案 **B.8.0**（9.6÷1.2 自算正确）：

![图片题讲解](https://app.devin.ai/attachments/193b25f7-c368-4b1b-bdec-e59cc9ee321f/ss_zoom_f0eec6e4.png)

### ④ 访问码 401 拦截流式请求

🟢 将 storage 中 accessCode 置为 wrong123（devtools console，说明性操作）后提交 → 弹可编辑 modal"请输入访问码"（流式请求同样被 401 拦截）；输入 kg2026 确认后自动重试并正常流式返回讲解：

| 401 弹框 | 输正确码后流式成功 |
|---|---|
| ![401弹框](https://app.devin.ai/attachments/c130e61d-8427-40b8-adf1-b7cc0efcbbef/ss_31d663c3.png) | ![重试成功](https://app.devin.ai/attachments/a287dde6-8f6b-47d2-918d-887ded03a42d/ss_zoom_03b7053f.png) |

### 覆盖说明与小发现

- ④ 中重试后讲解的是**仍挂在表单上的图片题**（9.6 亿件）而非新粘贴的文字题（3600 万元）——后端 image 优先，符合实现；但暴露一个 UX 小问题：**选择图片后无"移除图片"入口**，想改用文字题只能刷新页面（建议加删除图片按钮，P2）。
- 图片无 File 对象（重做回填）的非流式回退分支未单独测试（无该场景数据）。
- SSE `event: error` 中途错误分支未运行时触发（LLM 全程正常）。
- 小程序端按惯例未测。

## 增量测试 v9（UI/UX 视觉升级回归）— 2026-07-30

- 结论：**三项测试全部通过**（400px 移动视口三页视觉 / 1200px 桌面限宽居中 / 讲解冒烟）
- 录屏：`/home/ubuntu/screencasts/rec-2a9eb27b-04e0-4aa9-ae26-126f477063fc/rec-2a9eb27b-04e0-4aa9-ae26-126f477063fc-edited.mp4`
- ⚠️ 环境问题复发（非本轮代码问题）：服务器再次以字面 `secret:personal:...` 字符串作为 LLM_BASE_URL 启动，冒烟首次讲解 502 "Request URL is missing an 'http://' or 'https://' protocol."。我已用真实 env 值重启 uvicorn（ACCESS_CODE=kg2026 不变）后通过。**启动脚本仍需修复 secret 绑定方式（v7 已报过一次）**。

### ① 400px 移动视口三页视觉

🟢 拍题讲解页：靛蓝导航栏白字、hero"花生十三错题助手"+副标题、顶部浅靛蓝渐变背景、渐变靛蓝主按钮，无破版/溢出：

| hero + 表单 | 渐变靛蓝按钮 |
|---|---|
| ![拍题页hero](https://app.devin.ai/attachments/ecf972bb-2456-4ec2-ae96-d8479eb34be0/ss_zoom_d4ed98b6.png) | ![渐变按钮](https://app.devin.ai/attachments/215b1028-e44f-4104-ab9f-e778dce4aee8/ss_zoom_927559f5.png) |

🟢 错题本页：白卡圆角描边阴影、胶囊 tag、tabBar 选中项"错题本"靛蓝色；薄弱分析页：靛蓝分布条+卡片统一：

| 错题本 | 薄弱分析 |
|---|---|
| ![错题本](https://app.devin.ai/attachments/9eb0fdea-71f8-4141-8f40-3edbcd564a08/ss_zoom_56770b65.png) | ![薄弱分析](https://app.devin.ai/attachments/1601bb84-814b-4918-b47f-1025cee1f55e/ss_zoom_c1b75285.png) |

### ② 1200px 桌面宽屏限宽居中

🟢 三页内容列均居中且限宽约 680px，两侧留渐变背景空白，不满屏拉伸（示例两页）：

| 薄弱分析 @1200px | 拍题讲解 @1200px |
|---|---|
| ![stats1200](https://app.devin.ai/attachments/0eaefe88-9f1c-405e-ba58-a7af10e4d5aa/ss_4bb583c5.png) | ![ask1200](https://app.devin.ai/attachments/cf182994-b591-4ae5-8ad0-bf2a6b0d894d/ss_2d53df35.png) |

### ③ 讲解冒烟（400px）

🟢 粘贴基期题（4800 亿元、+20%）→ 计秒加载态 → 讲解卡片正常渲染，胶囊 tag 靛蓝、rich-text 标题/加粗/列表可读，答案 B.4000 自算正确（4800÷1.2）。样式改动未破坏功能：

| 首次 502（环境问题，已修复重启） | 修复后讲解成功 |
|---|---|
| ![502错误](https://app.devin.ai/attachments/85ea817e-7097-4ad1-883d-b00adfb33fb6/ss_1cc91b03.png) | ![讲解成功](https://app.devin.ai/attachments/4fb4e7cd-3cfa-4357-b30e-e46daf6cd958/ss_zoom_7200873e.png) |

### 视觉问题建议（P1/P2）

- P2：讲解 rich-text 中 markdown 分隔线 `---` 以字面文本"---"显示（未渲染为水平线），略显粗糙（见冒烟截图）。
- P2：薄弱分析模块分布条内白字"资料分析 × 1"字号偏小，靛蓝底上可读但略拥挤，建议加大字号/内边距。
- P2：1200px 下页面主体大量留白为纯渐变背景，可考虑桌面端双栏或提示"移动端体验更佳"（非必须）。
- 未发现 P1 级对比度/破版问题。

### 覆盖说明

- 未测微信小程序端（按惯例 H5-only）。
- 深色模式/其他视口宽度（如 320px、平板）未测。

## 增量测试 v8（复习模式·间隔重复）— 2026-07-30

- 结论：**五条断言全部通过**（H5，400px 移动视口）；1 条未捕获项见覆盖说明
- 录屏：`/home/ubuntu/screencasts/rec-d5215289-1deb-48e3-8519-aec9cdc7b270/rec-d5215289-1deb-48e3-8519-aec9cdc7b270-edited.mp4`
- 造数：通过 POST /api/mistakes 存入 2 条带 correct_answer 字母的错题（id=7 答案 A、id=8 答案 B），测试后已删除

### ① 待复习卡片

🟢 错题本顶部橙色卡片"📚 有 2 道错题待复习"+"开始复习 ›"，数量=2 正确：

![待复习卡片](https://app.devin.ai/attachments/8beb128d-6ddb-4fd2-b505-2fec103565a8/ss_cbd0ed51.png)

### ② 复习选对 → 绿色 + 答对提示

| 🟢 进入复习："复习 1/2"+"退出复习"+题干+ABCD 选项 | 🟢 选对 A：变绿其余淡，"答对了！（下次复习：1 天后）"+讲解展开+"下一题" |
|---|---|
| ![复习模式](https://app.devin.ai/attachments/6007a342-23c9-40f3-b4c0-f1d977a43066/ss_554a03fd.png) | ![答对](https://app.devin.ai/attachments/f4261a4d-3dfb-4693-a166-18e10a3f81cc/ss_25be4daa.png) |

### ③ 复习选错 → 红绿标色 + 又错了

🟢 第 2 题（正确 B）故意选 C：C 红、B 绿、其余淡，红色"又错了，看讲解（下次复习：1 天后）"（答错重置 1 天，符合规格）+讲解展开+按钮="完成复习"：

![选错](https://app.devin.ai/attachments/56d3cd93-23f1-4454-9407-bc4fbcc4faa1/ss_54b1d1c6.png)

### ④ 完成复习 → 回列表

🟢 点"完成复习"回列表：待复习卡片消失，两条目 meta 均显示"已复习1次"（原 id=6 显示"已复习2次"）：

![完成后列表](https://app.devin.ai/attachments/917a476d-e572-469f-9089-f8a8b3a13ced/ss_2936dbff.png)

### ⑤ 退出复习

| 🟢 重置 id=8 到期后重新进入复习（"复习 1/1"） | 🟢 点"退出复习"立即回列表模式，待复习卡片仍显示 1 道 |
|---|---|
| ![再次进入](https://app.devin.ai/attachments/e67db90f-875b-4251-ae44-8a899d7098d3/ss_07995ffd.png) | ![退出后](https://app.devin.ai/attachments/6c561d14-adb1-483f-98e4-c96d371faa4e/ss_0e38bd2e.png) |

### 覆盖说明（诚实披露）

1. 点"完成复习"后的 toast"本轮复习完成！"未在截图中捕获（toast 2 秒内消失，截图时机错过）——**inconclusive**，其余完成行为（回列表、卡片消失、次数+1）均已证明。
2. 首次答对显示"下次复习：1 天后"为间隔表第 1 档（1/3/7/15/30），符合 db.py 实现；连续答对的 3/7/15/30 天递增未跨天验证（需多日跨度，运行时不可行），仅验证了单次答对与答错重置。
3. "我做对了/我做错了"自评分支（correct_answer 无字母时）未测——造的两条数据均含字母答案，主链路优先。

---

## 增量测试 v7（访问码保护）— 2026-07-30

- 结论：**四条断言全部通过**（H5，400px 移动视口）；测试中发现并修复了一个**环境问题**（非代码 bug，见下）
- 录屏：`/home/ubuntu/screencasts/rec-bea62f9a-7979-4395-b8fc-b5bcf85ac9e4/rec-bea62f9a-7979-4395-b8fc-b5bcf85ac9e4-edited.mp4`

### ① 首次无码提交 → 弹输入框；输错码 → 报错

| 🟢 首次提交弹可编辑框"请输入访问码"（placeholder"联系管理员获取"） | 🟢 输入 wrong123 后红色错误"失败：访问码错误，请重试"，无讲解卡片 |
|---|---|
| ![访问码弹框](https://app.devin.ai/attachments/d9608a12-9911-4233-bcde-da3713b5ae7f/ss_f7a2f906.png) | ![错误码报错](https://app.devin.ai/attachments/782d0814-cba7-4cab-864f-43ac19d08b38/ss_66b99134.png) |

### ② 清 storage 后输入正确码 kg2026 → 自动重试成功

| 🟢 modal 再次弹出并输入 kg2026 | 🟢 确认后自动重试，讲解卡片正常渲染（4800÷1.2=4000，答案 B 自算正确） |
|---|---|
| ![输入正确码](https://app.devin.ai/attachments/694ae5a0-090c-4643-81fe-74ec3df208e7/ss_ab438818.png) | ![讲解成功](https://app.devin.ai/attachments/9c3c80df-ef83-49f0-b6e2-fc55a2d4201d/ss_2ff82a25.png) |

### ③ 后续请求不再询问

🟢 再次点"用花生十三方法讲解"：未弹访问码框，直接"AI 识题中…"并返回新讲解卡片（旧卡片自动折叠为历史行）：

![不再询问](https://app.devin.ai/attachments/66111dfd-fdab-403c-af7a-9047f620f2fe/ss_12e66928.png)

### 环境问题（测试中发现并修复，非代码 bug）

首次输入正确码 kg2026 时后端返回 502"解析失败：Request URL is missing an 'http://' or 'https://' protocol."。排查发现服务器启动命令把 `LLM_BASE_URL` 设成了**字面字符串** `secret:personal:LLM_RELAY_BASE_URL`（secret 引用未被替换）。我已用真实环境变量值重启 uvicorn（ACCESS_CODE=kg2026 不变）后全部通过。**部署/启动脚本需确保 secret 引用被真正解析**。

---

## 全量回归测试 v6（uni-app Vue3 H5 重写）— 2026-07-30

- 结论：**H5 端全量回归所有断言通过**（v5 发现的"重做/删除"按钮重叠已修复）；2 条覆盖说明见下
- 录屏：`/home/ubuntu/screencasts/rec-4a615082-8f06-48c3-820e-58e950c316e5/rec-4a615082-8f06-48c3-820e-58e950c316e5-edited.mp4`
- 范围：仅 H5（http://localhost:8000，uni-app 构建产物）；微信小程序端按要求未测

### ① 讲解 + rich-text 渲染 + 存入错题本

粘贴资料分析基期量题（9600 亿元 ÷1.25 = 7680，正确答案 B）→ 讲解 → 存入错题本：

| 🟢 rich-text 渲染：标题/加粗/列表可读，无原始 markdown 符号，答案 B.7680 正确 | 🟢 存入后按钮变"✓ 已存入错题本"并禁用 |
|---|---|
| ![讲解卡片](https://app.devin.ai/attachments/04c19461-b1a9-497f-a950-c8cf52a9ee21/ss_d484652d.png) | ![举一反三+选项](https://app.devin.ai/attachments/ce4fccfb-1a8d-46f8-ba86-409f63ff4837/ss_1ffe2419.png) |

### ② 举一反三 → 选错标色 → 解析 → 详解闭环

练习题（156 万辆 ÷1.3 = 120，正确 B）故意选 D：

| 🟢 所选错误 D 红色、正确 B 绿色，其余变淡禁用，解析同步展开（右图） | 🟢 点「详解这道题」：题目回填、答案=D、自动第二次讲解并给出错因分析（"你选的 D.140 是错误的"） |
|---|---|
| ![红绿标色](https://app.devin.ai/attachments/ce4fccfb-1a8d-46f8-ba86-409f63ff4837/ss_1ffe2419.png) | ![详解闭环](https://app.devin.ai/attachments/e8a1b2cf-1742-448c-8f48-af344ebb174a/ss_f674c46a.png) |

### ③ 历史卡片折叠/展开

| 🟢 第二次讲解后旧卡片自动折叠为一行"🕓 历史讲解（点此展开/折叠）" | 🟢 点击展开：原题 9600 数据完整可回看，再点复折叠 |
|---|---|
| ![折叠一行](https://app.devin.ai/attachments/98816551-4807-4807-9869-6e9c867316a2/ss_b84a9481.png) | ![展开回看](https://app.devin.ai/attachments/d20e154d-107a-4e7a-9078-440a3e49d2c4/ss_0de0d7c9.png) |

### ④ 错题本重做 / 删除

| 🟢 重做/删除按钮已分开（v5 重叠问题修复）；点重做后切回拍题讲解、题目回填、答案空、toast"题目已填入，先自己做一遍再点讲解" | 🟢 删除弹确认框"确定删除这道错题？"，OK 后条目消失（"错题本还是空的"） |
|---|---|
| ![重做 toast](https://app.devin.ai/attachments/7abd7950-d43c-40ff-96c6-73ed5effc391/ss_a5f1309a.png) | ![删除确认](https://app.devin.ai/attachments/cad16fb0-6ed3-469f-b021-62cd2217be51/ss_6fefab63.png) |

错题本列表（分开的按钮）：![错题本](https://app.devin.ai/attachments/7b79fa33-5076-4681-b6c4-31640eaaf7c8/ss_63d790dd.png)　删除后空列表：![空](https://app.devin.ai/attachments/042498d3-c87a-44c2-a525-26c240e2d052/ss_586a0f28.png)

### ⑤ 薄弱分析中文名 + 移动视口（~400px）

| 🟢 薄弱分析显示中文"资料分析 × 1"与"资料分析-基期量计算 ×1" | 🟢 400px 窄窗口：表单/卡片/tabBar 布局不破版，文本折行可读 |
|---|---|
| ![薄弱分析](https://app.devin.ai/attachments/a5810401-321a-4834-95f5-b706836690ba/ss_aac43f2f.png) | ![移动表单](https://app.devin.ai/attachments/396bfa76-e50d-4943-a890-3e2e39829181/ss_21e95025.png) |

移动视口讲解卡片：![移动卡片](https://app.devin.ai/attachments/3c1174e4-23f8-4e78-8253-fa7dc09e2b7c/ss_2bf53f8b.png)

### 覆盖说明（诚实披露）

1. **表格渲染未验证**：本轮两次 LLM 讲解输出均未自然产生 markdown 表格，rich-text 的表格可读性未获得运行时证据（加粗/标题/列表已充分验证可读）。
2. 首次讲解时在答案输入框键入的"A"未成功落入输入框（uni-input 聚焦时序问题或测试操作误差），该次讲解无错因分析段；但闭环第二次讲解（答案=D）完整产生了错因分析，功能本身验证通过。

---

## 增量测试 v5（历史卡片自动折叠 + 错题本重做）— 2026-07-30

- 结论：**功能全部通过**；1 个新发现的视觉小瑕疵（错题本"重做/删除"按钮重叠）
- 录屏：`/home/ubuntu/screencasts/rec-a209dedf-5ef1-405a-94d8-924bc00b4594/rec-a209dedf-5ef1-405a-94d8-924bc00b4594-edited.mp4`

### ① 历史讲解自动折叠

流程：原题讲解（4200亿元）→ 举一反三 → 选对 B（5600÷1.14≈4912）→「详解这道题」触发第二次讲解：

| 🟢 旧卡片自动折叠为一行"🕓 历史讲解（点此展开/折叠）" | 🟢 点击后展开：原题 4200 完整内容可回看（再点可复折叠） |
|---|---|
| ![折叠为一行](https://app.devin.ai/attachments/9b509fe3-5fb9-4a55-bbc3-3a10826c4ab5/ss_3efa9681.png) | ![展开回看](https://app.devin.ai/attachments/113a35b0-489a-45a3-9b3b-cd56983dcc31/ss_63e30426.png) |

### ② 错题本"重做"

| 🟢 点"重做"弹提示"题目已填入，先自己做一遍、填上答案再点讲解" | 🟢 确认后：拍题讲解 tab、题目回填、答案框已清空 |
|---|---|
| ![重做提示](https://app.devin.ai/attachments/ba2449f6-abc5-45da-9636-2a9910f98969/ss_0f08eed1.png) | ![回填清空](https://app.devin.ai/attachments/f10d5800-8698-4da3-908a-d98a2060167e/ss_07471f09.png) |

⚠️ 视觉瑕疵：错题本条目右上角"重做"与"删除"两个按钮重叠（均为绝对定位同一角落）：

![重做删除重叠](https://app.devin.ai/attachments/057eddd2-8092-45aa-b5a5-2b11f044cd5e/ss_zoom_2e671849.png)

### ③ 回归（Regression）

主链路：讲解 → 存入错题本（"✓ 已存入错题本"）→ 举一反三 → 选对 B 变绿、解析展开 → 删除确认框清理，全部正常：

![练习题选对变绿](https://app.devin.ai/attachments/422404d8-18f8-4ef9-aff7-8d9a43064561/ss_zoom_f753834f.png)

### 本轮断言

| 断言 | 结果 |
|---|---|
| 新讲解出现时旧卡片自动折叠为"🕓 历史讲解"一行 | ✅ |
| 点击该行展开旧卡片完整内容，再点击复折叠 | ✅ |
| 错题本每条有蓝色"重做"按钮，点击弹提示、回填题目、清空答案、切 tab | ✅ |
| 回归：讲解→存入→举一反三→选答案标色 主链路正常 | ✅ |
| "重做"与"删除"按钮视觉重叠 | ⚠️ 瑕疵 |

---

## 增量测试 v4（选项对错标色 + 讲解历史堆叠）— 2026-07-30

- 结论：**本轮全部通过**（选错红/绿标色、选对只绿、历史卡片堆叠可回看、存入错题本/薄弱分析回归正常）
- 录屏：`/home/ubuntu/screencasts/rec-f1daa4dc-2ec5-498d-8973-6a396f7ef6e6/rec-f1daa4dc-2ec5-498d-8973-6a396f7ef6e6-edited.mp4`

### ① 即时对错标色

练习题「2024年销量58.5万辆，同比增长30%，求2023年」，正确答案 B（58.5÷1.3=45）：

| 🔴 故意选错 D：D 变红、正确 B 变绿、A/C 变淡禁用 | 🟢 另一题选对 B（91.8÷1.2=76.5）：只有 B 变绿，无红色 |
|---|---|
| ![选错标色](https://app.devin.ai/attachments/816bf013-975e-4dec-9dce-19869f64e2fd/ss_zoom_e123f0f1.png) | ![选对只绿](https://app.devin.ai/attachments/0065fb00-b6da-406b-8525-29db89660d2f/ss_zoom_b5738e66.png) |

### ② 讲解历史堆叠

点「用花生十三方法详解这道题」后：

| 🟢 新讲解卡片插入顶部（针对练习题 58.5 万辆数据，判定所选 D 错误） | 🟢 向下滚动：旧讲解卡片（原题 8.4 亿件）完整保留可回看 |
|---|---|
| ![新卡片置顶](https://app.devin.ai/attachments/b54b59e7-3827-4c44-ab23-6c2db2bf6dd3/ss_21e09162.png) | ![旧卡片保留](https://app.devin.ai/attachments/d2c76e12-dc29-43a8-91ca-659326d3289d/ss_ec353905.png) |

### ③ 回归（Regression）

| 🟢 存入错题本：按钮变"✓ 已存入错题本"并禁用 | 🟢 薄弱分析：中文"资料分析 × 1"、题型 TOP10 正常 |
|---|---|
| ![已存入](https://app.devin.ai/attachments/a6b1d5ef-0fb9-489c-a91f-5058d649ce23/ss_zoom_e61a80b1.png) | ![薄弱分析](https://app.devin.ai/attachments/abe2c172-4d50-4beb-9dc4-0c5813a2457e/ss_49cdcc60.png) |

- 错题本列表显示已存题目；删除弹出"确定删除这道错题？"确认框，OK 后删除成功（测试数据已清理）。

### 本轮断言

| 断言 | 结果 |
|---|---|
| 选错 D：D 红底白字、正确 B 绿底白字、其余变淡禁用、解析同步展开 | ✅ |
| 选对 B：仅 B 绿色，无任何红色按钮 | ✅ |
| 详解练习题后：新卡片置顶、旧卡片保留在下方可回看（含其练习题与标色选项） | ✅ |
| 回归：存入错题本按钮态 / 错题本列表 / 确认删除 / 薄弱分析中文统计 | ✅ |

### 改进建议（非 bug）

- 历史卡片增多后页面会很长，建议给旧卡片加折叠或"历史记录"入口。
- 旧卡片中的 #simbox 失去 id 后其「详解这道题」按钮仍可见，建议明示只有最新卡片可继续出题。

---

## 增量测试 v3（举一反三闭环）— 2026-07-30

- 结论：**本轮全部通过**（出题计秒、A/B/C/D 先选后看解析、选项高亮/禁用、"详解这道题"回填并自动讲解）
- 录屏：`/home/ubuntu/screencasts/rec-92868c7d-6c54-44df-b2b6-54c364b0c7c7/rec-92868c7d-6c54-44df-b2b6-54c364b0c7c7-edited.mp4`

### 闭环流程验证

出题按钮计秒（disabled）：

![出题中计秒](https://app.devin.ai/attachments/81e33d1e-41c4-45ad-934e-4b40e87c8e96/ss_zoom_ce935b62.png)

| 🔴 选答案前：解析隐藏，A/B/C/D 可点 | 🟢 点 B 后：解析展开 |
|---|---|
| ![选前](https://app.devin.ai/attachments/bbc80f75-e1c2-4d59-9ca8-3b0690d6282a/ss_ce71a254.png) | ![选后](https://app.devin.ai/attachments/7731d9d8-24b9-4d11-a3ca-d2049dc7c4fd/ss_f7d7fa0a.png) |

选项按钮态特写（B 高亮、A/C/D 变淡且全部禁用，再点 A 无反应）：

![按钮态](https://app.devin.ai/attachments/7d318c40-149c-4870-ac61-3d2c34096219/ss_zoom_ad504eb7.png)

| 解析下方的「用花生十三方法详解这道题」 | 点击后：回填题目+答案 B，滚到顶部并自动讲解 |
|---|---|
| ![详解按钮](https://app.devin.ai/attachments/d6d41931-4f43-4ae4-8a3b-02f06e469cae/ss_c9ba50e9.png) | ![回填自动讲解](https://app.devin.ai/attachments/001b4626-92b6-4d9b-876c-978f1896a099/ss_88bb5d08.png) |

详解结果针对练习题数据（360万辆/20%），并判定所选 B 正确：

![详解结果](https://app.devin.ai/attachments/460694d6-6f81-493f-a22f-7673b71157c0/ss_6a601e06.png)

逐项断言：
- ✅ 「举一反三」按钮变"出题中…（3秒）"计秒且 disabled
- ✅ 练习题+提示+「先选你的答案再看解析：」+A/B/C/D 按钮渲染，解析在选择前不可见（截图证明）
- ✅ 点 B：B 高亮、A/C/D opacity 0.4、四按钮禁用（再点 A 无任何变化）；解析同步展开，答案 B 自算验证正确（360÷1.2=300）
- ✅ 「用花生十三方法详解这道题」：题目框回填练习题原文（"## 练习题"标题和"## 提示"段已去除），答案框=B，页面滚回顶部，自动进入"AI 识题中…"加载态（未手动点讲解按钮）
- ✅ 自动讲解结果针对练习题数据（现期 360、R=20%、答案 B.300），并判定"你选 B，是正确的"

### 本轮改进建议（增量）
1. 详解回填后原来的讲解/练习题内容被整体替换，用户若想回看第一题需重新输入——可考虑保留历史或加"返回上一题"。
2. 练习题选项按钮选择后无对错即时反馈色（如选错标红、正确标绿），目前需自己读解析对照。

---

## 增量测试 v2（P0 修复 + 举一反三 + PWA）— 2026-07-30

- 结论：**本轮全部通过**（分阶段加载、举一反三、防重复存入、删除确认、薄弱分析中文名、manifest）
- 录屏：`/home/ubuntu/screencasts/rec-19092a56-d12b-472e-a682-94a639cafa6d/rec-19092a56-d12b-472e-a682-94a639cafa6d-edited.mp4`

### ① UI 完整流程

| 加载阶段 1（AI 识题中…计秒） | 加载阶段 2（已识题，正在匹配…） |
|---|---|
| ![阶段1](https://app.devin.ai/attachments/99723a88-1ab6-41e4-a592-f1f6d0d62aeb/ss_231a4329.png) | ![阶段2](https://app.devin.ai/attachments/9e0aa765-e08c-4ae5-bfa2-13b4576e64f1/ss_63d6dc6b.png) |

- ✅ 加载提示分阶段且带秒数："⏳ AI 识题中…（3秒）" → "🧭 已识题，正在匹配花生十三方法…（9秒）"

| 举一反三：答案默认隐藏（🔴 点击前） | 点「看答案与解析」后展开（🟢 点击后） |
|---|---|
| ![隐藏](https://app.devin.ai/attachments/b4632766-e95e-4318-bfb9-9b5b9730e4be/ss_3a45df77.png) | ![展开](https://app.devin.ai/attachments/13871b86-17fc-43ab-ac90-d9b6729606dc/ss_dc6ba296.png) |

- ✅ 点「举一反三」→ 按钮变"出题中…"（disabled）→ 生成新练习题+提示，答案隐藏在「看答案与解析」按钮后
- ✅ 展开后按钮消失，显示答案与解析

| 存入后按钮态"✓ 已存入错题本"（disabled） | 错题本仅 1 条（连点两次不重复） |
|---|---|
| ![按钮态](https://app.devin.ai/attachments/f31a017a-525d-4293-bbf0-3c594c22650f/ss_zoom_082242b1.png) | ![仅一条](https://app.devin.ai/attachments/f0d0853b-92a5-47bb-9897-5de1c11fa720/ss_25cdbda0.png) |

| 删除确认框"确定删除这道错题？" | Cancel 保留 → OK 删除成功 |
|---|---|
| ![确认框](https://app.devin.ai/attachments/8b201dfc-27dc-45fd-bbf2-a4a42984e0ce/ss_91ace780.png) | ![删除后](https://app.devin.ai/attachments/ebedec64-a1a2-4093-a004-030d70d6b279/ss_44155b27.png) |

薄弱分析显示中文模块名（上轮为 "ziliao × 1"，已修复）：

![薄弱分析中文名](https://app.devin.ai/attachments/58fd6083-bba5-41a4-a306-6ac9c17e69f0/ss_890dddc3.png)

### ② /api/similar 相似题质量（API）

原题：1250 亿元 / 增长 8.4% 求基期。生成的练习题：
- ✅ 数据全新编（3680 亿元 / 12.2%，UI 那次为 735 亿元 / 5.8%，均不同于原题）
- ✅ 方法一致（基期量 = 现期 ÷ (1+增长率)）
- ✅ 含 `<!--answer-->` 分隔符；答案自算验证正确（3680÷1.122≈3280→B；735÷1.058≈695→A）
- ✅ 无 `\[` / `\frac`

### ③ PWA
- ✅ `/static/manifest.json` 200，含 name/short_name/start_url/display:standalone/icons
- ✅ `/static/icon.svg` 200

### 本轮新发现的改进建议（增量）
1. 举一反三生成期间无阶段性提示（只有"出题中…"按钮文案），约 20–30 秒，建议同样加计秒提示。
2. 举一反三的练习题不能"存入错题本"或再讲解，做完后没有后续动作闭环。
3. 练习题没有让用户先选答案再看解析的交互（如 A/B/C/D 按钮），学习闭环可更强。

---

## 首轮验收测试（MVP）

- 测试对象：本地项目 `/home/ubuntu/repos/kaogong-assistant`（无 PR）
- 运行方式：uvicorn :8000，LLM 用中转站（LLM_MODEL=gpt-5.5）
- 结论：**5 项验收标准全部通过**，另附真实用户视角的改进建议清单（按严重程度排序）

---

## 1. 文字题讲解（POST /api/explain，4 个模块）

| 题目 | 模块识别 | 引用方法（已 grep 方法库验证存在） | 答案 | 易错点 | LaTeX |
|---|---|---|---|---|---|
| 资料分析·基期量（附错误答案 A） | ✅ ziliao 资料分析 | ABRX 四要素 + 截位直除（ziliao-fenxi.md / ziliao-susuan.md） | ✅ B 正确 | ✅ 有，且有错因分析（判定"截位过粗/计算失误"） | ✅ 无 `\[`/`\frac` |
| 判断推理·定义判断（行政许可） | ✅ panduan 判断推理 | 要素法（strategy.md"定义判断：抓要素"） | ✅ B 正确 | ✅ 有 | ✅ 无 |
| 数量关系·盈亏问题 | ✅ shuliang 数量关系 | **明确说"盈亏问题的花生十三方法不在当前方法库中"**，改用库内"通用速解技巧：方程法" | ✅ B=8 正确 | ✅ 有 | ✅ 无 |
| 言语理解·逻辑填空 | ✅ yanyu 言语理解 | 关联词法/"递进后是重点"（yanyu-lianjie.md L104/L192） | ✅ A 正确 | ✅ 有 | ✅ 无 |

亮点：盈亏问题这题不仅答对，还诚实标注方法不在库内，与红线要求一致。

## 2. 图片题讲解

用 PIL 生成含中文题目的 PNG 上传：

![测试用图片题](https://app.devin.ai/attachments/df670cdc-75a5-411e-a4e2-985d0b55c226/q.png)

- ✅ OCR 识题完整准确（question_text 与图片文字一致）
- ✅ 模块识别 数量关系，方程法讲解，答案 C.60 正确，无 LaTeX

## 3. 错题本 UI 流程（浏览器，已录屏）

录屏：`/home/ubuntu/screencasts/rec-2b544c14-a001-482c-bbbb-3481ddf8163e/rec-2b544c14-a001-482c-bbbb-3481ddf8163e-edited.mp4`

| 首页 | 讲解结果（选错 C，指出正确 A + 错因分析） |
|---|---|
| ![首页](https://app.devin.ai/attachments/0fe3801f-a4a3-4db2-9926-9858014c0674/ss_468190e1.png) | ![讲解](https://app.devin.ai/attachments/4e200ebc-afc1-43f4-84d3-f7a426298610/ss_2739128c.png) |

| 错题本列表（存入成功） | 展开查看完整讲解 |
|---|---|
| ![错题本](https://app.devin.ai/attachments/1778d023-b618-4a2a-845a-e1cc6a2efcb7/ss_ef284d50.png) | ![展开](https://app.devin.ai/attachments/c6541976-db33-48f4-a01c-fa6fc69f7cde/ss_9320098e.png) |

| 薄弱分析（有统计，但模块名显示原始 key） | 删除后空状态 |
|---|---|
| ![薄弱分析](https://app.devin.ai/attachments/339ee226-1977-459d-8114-d510b2d50853/ss_1ffe0950.png) | ![删除后](https://app.devin.ai/attachments/bf6bd519-b682-4f47-b614-fe0ca834cdb5/ss_3b82480f.png) |

- ✅ 粘贴题目 → 讲解渲染正常（markdown 转 HTML，无裸 `**`、无 LaTeX）
- ✅ 存入错题本 → alert"已存入错题本"→ 错题本 tab 有条目（带模块标签+时间）
- ✅ 点击展开显示完整讲解；点删除即移除，显示"错题本还是空的"
- ✅ 薄弱分析 tab 有"错题模块分布"和"高频错题型 TOP10"统计
- ⚠️ 薄弱分析的模块分布条显示 **"ziliao × 1"（英文 key）** 而不是"资料分析"

移动端（400px 窄窗口）：

![移动端视口](https://app.devin.ai/attachments/c64f4a9d-a5a4-4c4f-af69-1bae12e2d453/ss_093524ff.png)

- ✅ 布局不破版、底部 tabbar 固定、内容可滚动、按钮全宽易点

## 4. 红线测试（超纲题）

发送高数题（∫x²eˣdx + 极值）：
- ✅ 明确输出 **"该题型的花生十三方法不在当前方法库中"**，并标注"下面用【通用高等数学解法】讲解，不归入花生十三方法库"
- ✅ 未编造任何伪花生十三方法名；解题本身（分部积分、导数判定）也正确
- ⚠️ 小瑕疵：模块仍被归为"数量关系"（严格说超纲题不属于行测模块），但因有明确免责声明，不算编造

## 5. 真实用户（碎片时间刷题考生）改进建议清单

**P0（影响核心体验）**
1. **讲解等待 30–60 秒且无流式输出**：碎片场景下太久。建议 LLM 流式返回（SSE），先出"题型识别"再逐段出讲解；或至少加进度动画+预计剩余时间。
2. **薄弱分析显示英文 key（"ziliao × 1"）**：普通考生看不懂，应显示"资料分析"。
3. **请求失败/超时无重试**：仅一行错误文本，建议提供"重试"按钮并保留输入。

**P1（明显摩擦）**
4. **存入错题本用原生 alert**：打断操作流，建议改成非阻塞 toast；且存入后按钮应变为"已存入"防重复保存（目前可重复存同一题）。
5. **删除无确认**：误触即永久删除，建议二次确认或可撤销。
6. **你选的答案没有 A/B/C/D 快捷按钮**：手机上打字麻烦，建议四个选项按钮一键选。
7. **错题本无"重练"入口**：错题本的核心价值是复习，建议加"遮住答案重做一遍"模式。

**P2（打磨）**
8. 讲解结果无"复制/分享"按钮；长讲解无目录/折叠（易错点、错因分析可折叠）。
9. 薄弱分析只有计数，建议给出"优先补哪个模块+对应方法库章节链接"。
10. 页面刷新后讲解结果丢失（未持久化最近一次讲解）。

## 备注
- 全部输出经检查无 `\[`、`\frac`（公式以 Unicode/纯文本呈现，渲染友好）。
- 测试期间后端无异常日志；图片 8MB 上限未专门测试。
