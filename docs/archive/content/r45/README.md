# 轮45 报告：发现线例行（轮44复验 / 五Tab UX 走查 / 健康快扫 / 数据例行）

分支：`devin/1786297925-r44`（PR#111）。本轮代码改动仅 1 处 P1 UX 修复（小程序迷你模考退出确认）；另完成一次生产内容治理（hs 尾部结论字母批量修正 1312 条，见 §3）。

## 1. 轮44 三项线上复验

### 1.1 小程序模考闭环

- 环境说明：本机为 Linux VM，微信开发者工具（仅 Windows/macOS）无法安装，故采用「生产 API 全闭环实测 + 五 Tab/模考页面逐文件代码走查」替代，接口契约与页面逻辑均逐项核对。
- 生产 API 闭环实测（uid=r45qa_mini，测试数据已清理）：
  - `POST /api/exam/start` → attempt_id、30 题、时长 30 分钟 ✓
  - `POST /api/exam/submit`（1-based picks/secs）→ score 33.3，10/30 ✓
  - `GET /api/exam/report/{id}` → weak_tags 返回 3 条（翻译推理/基础代数计算/语句填空）✓
  - 「去练 ›」等价请求 `GET /api/questions?tag3=PD-LJ-01&adaptive=1&limit=10` → 返回 10 题且 tag3 匹配 ✓
- 页面逻辑走查（mini.ts/report.ts/practice.ts）：倒计时/答题卡/空题确认/交卷 redirect/报告薄弱卡 → practice 接收 tag3 全链路正确。
- 残留缺口：真机/开发者工具 GUI 走查待有 Windows/macOS 环境时补做（P2）。

### 1.2 H5 分享 A/B 分桶与 v 参数归因（生产实测）

- 稳定分桶：以两个分别命中 a/b 桶的 uid 作为分享者，落地页点「复制分享链接」，剪贴板实测：
  - a 桶：`…share-q?sid=…&v=a`，文案「我刚做了一道题，你能做对吗？…」✓
  - b 桶：`…share-q?sid=…&v=b`，文案「敢不敢挑战这道题？…」✓
- 归因：以 `v=a`/`v=b` 打开落地页并作答，growth_events 实测 `share_open/share_a`、`share_answer/share_a`、`share_open/share_b` 入库 ✓（share_b 的 share_answer 因同一浏览器 uid 已答过该 sid 被后端去重，属预期）。
- 无 v 参数打开时归因回退为 `share`（旧链接兼容）✓；分享者复制事件 `share_copy/share_q` 正常。
- 已知设计点（沿轮44记录）：落地页 onward copy 按当前用户重新分桶生成 v，不继承 incoming v——属「按人分桶」口径，非 bug。
- 测试 share/事件/作答数据已备份（bak_r45_qa.db）后守卫清理，残留 0。

### 1.3 cron 与首份周报

- crontab 在位：`0 8 * * 1 …/deploy/cron_access_report.sh # kaogong-access-weekly`；服务器 TZ=Asia/Shanghai，周一 08:00 CST=周一 00:00 UTC ✓。
- 首份周报 `/home/ubuntu/kaogong-reports/access-weekly-20260809.txt`（887B）：仅聚合统计（总量//tiku//UA 分类/状态码/Top20），敏感词扫描（token/key/secret/password/LLM_/ACCESS_CODE）0 命中 ✓。
- 数据 caveat：窗口内 147 请求全为自测流量（爬虫 0/curl 56/python 14），且轮43记录的 Caddy 重载导致此前约 1.5 天日志缺失仍然适用，历史不完整照实报。
- 另见服务器既有 `kaogong-ops.sh` 每日 03:40 备份+健康巡检 cron（轮前已在位，工作正常）。

## 2. 小程序五 Tab UX 走查（首页/错题本/模考/统计/我的）

方式：五 Tab 页面 + mini/report/practice 逐文件走查（ts+wxml），结合生产 API 行为核对。体验评分 8/10：主流程（刷题目标→专项练习→错题复习→模考闭环→统计/徽章）衔接完整，空态/加载态齐全，埋点齐全。

### P1（当轮已修）

- 迷你模考进行中误触返回/手势退出会直接丢弃 30 题作答且无任何确认。已加 `wx.enableAlertBeforeUnload`（开考后启用、交卷跳转前解除），tsc+eslint 通过。

### P2 清单（不当轮修）

1. 错题本复习模式仅显示题干+ABCD 字母，无选项文本（Mistake 数据结构无 options，需后端补字段），依赖用户记得原题；H5 同口径。
2. 收藏 Tab 仅展示题面文本，无查看详情/取消收藏/去练习操作。
3. 模考 Tab 真题卷列表全部「二期开放」，点击无反馈（可加 toast 说明）。
4. 统计页分模块正确率为本机口径，与服务端热力图（answer_log）口径并存，未标注差异原因。
5. 首页错题复习任务行在 dueLoaded 前短暂显示「加载中…」，弱网下时间可能偏长。
6. 微信开发者工具真机 GUI 走查待补（环境限制）。

## 3. 全站健康快扫（含一次内容治理）

### 3.1 新发现并已修复：hs 尾部结论字母错位 1312 条

- 例行扫描（尾部「确认答案为X」结论 vs answer 字段）发现 1312 条不一致：shuliang 944 / yanyu 368——为历史 r28 批量生成时选项乱序前撰写导致的字母错位，正文推理与依据均正确、指向的内容即 answer 选项内容，仅字母引用错位。
- 处置（备份 `bak_r45_hsfix.db` → dry-run → 守卫事务 → 复扫）：
  - shuliang：正文按数值验证（正确选项数值出现在推理正文）后仅替换尾部结论字母；
  - yanyu：结论字母与 answer 字母全篇互换（排除性引用同步对调），抽样人工核对 89 条（含全部启发式告警项）确认互换后语义正确；
  - 应用 1312 条，answer/options/question/explanation/disabled 全库哈希与备份一致（零变更），复扫尾部结论不一致 0，线上 /tiku/ 渲染抽查正常。

### 3.2 快扫结果（修复后）

- active 112,962；options 非 JSON 0；`(cid:` 乱码 0；hs 尾部结论不一致 0。
- 四模块 hs 空缺仅剩已知存疑台账 2 条：changshi:655861、panduan:334296。

## 4. 数据例行（A/B 首批样本照实报）

- A/B 事件（share_a/share_b/qbar_*/book_*）自然样本 0 条——上线约 1 天且站点自然流量极低，QA 测试事件已清理未计入；无法计算转化，待流量积累。
- 近 7 天：作答 73 次 / 12 uid；模考 attempt 10 次 / 8 uid；分享类自然事件个位数（share_open 4、share_answer 2 等，均为旧 `share` 归因）。
- 获客仍是最大瓶颈（沿轮43结论）；站长平台验证/LLM key/ACCESS_CODE 等待老板资源。

## 5. 验证命令

- `miniapp-native`: `npx tsc --noEmit` ✓、`npx eslint . --quiet` ✓（本轮唯一代码改动 mini.ts）。
- H5/Flutter/后端零改动，未触发 deploy_h5.sh / flutter analyze。
- 小程序改动随下次发版生效，无需生产部署。

## 6. Caveat

- AI 功能保持降级（LLM key/ACCESS_CODE 待补发，已催办）。
- access log 历史窗口不完整（轮43 Caddy 重载事故），周报趋势需从本周起算。
- A/B 结论需自然样本，首批照实为 0。
