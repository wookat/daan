# R339 设计方案：AI 问答会话「查看原题」反向闭环 + 历史会话空态陈旧文案修正

## 取证（一手，生产代码 + 生产站行为）

1. R336 起 ask 会话 item 已携带 qid（`pendingQid` 消费、`persistSession`/`adoptItems` 透传），六个复盘场景「题 → AI」与「回看 AI 详解」命中态（R336–R338）均已闭环。
2. 反向缺口 verified：ask 页 AI 讲解 bubble 的 chips 只有「再讲细一点 / 出一道同款题 / 存入错题本」，**没有任何从会话回到题目本体的入口**。用户看完 AI 详解后想收藏本题 / 纠错 / 看讨论 / 复制本题链接，只能凭记忆去搜索——qid 数据就位但反向导航为零（粉笔 AI 讲题可回到题目页）。
3. 承接能力 verified：`/api/search` 对纯数字 q 走 `code_hit` 直达（insights.py），搜索页 `onLoad` 支持 `?q=<qid>&qid=<qid>` 深链并自动 `toggleDetail` 展开详情（R270）；详情内已有收藏 / 纠错 / 讨论 / 复制链接 / AI 详解全套出口。
4. 陈旧文案 verified：ask.vue 历史会话空态写着「仅保存在本机」，但 R328 起历史会话已服务端同步跨设备——对用户是错误承诺（低估了产品能力，也与 R332 进行中会话同步矛盾）。

## 方案（纯前端 + 埋点白名单一行，零新 endpoint/表/URL 契约）

1. `ask-link.js` 新增 fail-closed 纯函数 `askViewUrl(qid)`：
   - `askQid(qid) > 0` → 返回 `/pkgA/search/search?q=<qid>&qid=<qid>`；
   - 否则返回 `null`（图片讲解 qid=0、legacy 会话、非法值一律不出入口）。
2. `ask.vue` AI 讲解 bubble chips 行尾追加「查看原题」chip：
   - `v-if="askViewUrl(r.qid)"`（legacy/图片讲解不显示，不误导）；
   - 点击 → `trackEvent('ask_view_question')` → `uni.navigateTo(url)`；
   - 搜索页 code_hit 直达 + `?qid` 自动展开详情；若题目已下架 code_hit 缺失，搜索页自然降级为空结果页（fail-safe，不白屏）。
3. 历史会话空态文案：「仅保存在本机」→「同一账号换设备也能看」（对齐 R328 事实）。
4. `team.py` `/api/track` 白名单补 `ask_view_question`（吸取 R333 静默 400 教训）。

## 不改变

- `findAskSid`/`askOpenSid`/`redoQuestion`/`redoAnswer`/`redoQid` 协议；
- `/api/explain`、后端 endpoint、DB schema、URL 契约；
- 搜索页既有 `?q`/`?qid` 深链行为（纯消费方）。

## 验证计划

- vitest：`askViewUrl` 正常/qid=0/非法/字符串数字用例；
- pytest：`ask_view_question` 埋点 200 + bogus 400（既有白名单契约测试口径）；
- 本地 ruff/pytest/pyright/lint/vitest/build 全绿；
- 部署后 testing agent 生产实测：讲解会话 chip 出现 → 点击直达搜索详情展开同题；图片讲解/legacy 会话无 chip；埋点 200；空态新文案；375/1440 溢出 0、console 0 error、全程 0 次 /api/explain（用注入会话，不触发真实 LLM）。
