# 轮44：小程序迷你模考报告页 + H5 分享链路增强 + access log 周报 cron 化

分支：`devin/1786297925-r44`（从最新 main 切出）。本轮零生产题目数据变更。

## 1. 小程序迷你模考报告页（三端 parity）

原生小程序此前「迷你模考」只是跳转普通刷题（20题混合），无成绩报告。本轮升级为真实模考闭环，复用后端既有接口（`POST /api/exam/start`（mini）/ `POST /api/exam/submit` / `GET /api/exam/report/{id}`），未新增后端端点。

新增/改动：

- `pages/exam/mini`（新增）：30 题混合模考，30 分钟倒计时、进度条、答题卡浮层、未答确认、逐题耗时统计，交卷后 redirect 到报告页；模考作答计入本地统计（与 H5 同口径）。
- `pages/exam/report`（新增）：得分、正确率、用时、各模块得分条、逐题对错网格+详情浮层（含花生十三讲解/原解析）、**薄弱考点卡**（后端 `weak_tags` 前3）+ 每项「去练 ›」直达强化练习，另有「再考一次/返回模考」。
- `pages/practice/practice.ts`：支持 `tag3` 参数（`adaptive` 拉题），承接薄弱考点强化入口（`source=exam_weak`）。
- `pages/exam/exam`：迷你模考入口改跳 `mini` 页，文案更新。
- `api/index.ts` + `api/types.ts`：`examStart/examSubmit/fetchExamReport` 及完整类型。

校验：`npx tsc --noEmit` ✅、`npx eslint . --quiet` ✅。生产 API 契约验证：以测试 uid 走 start(mini 30题)→submit(picks 按 1-based 题号)→report，返回 `weak_tags` 3 项与 30 条逐题结果，测试数据（exam_attempts 2 条 / answer_log 30 条）已守卫清理为 0。

小程序为客户端改动，随下次发版生效。

## 2. H5 分享链路增强（r43 建议：分享文案 A/B）

- `api.js` 新增 `shareVariant()`（按 uid 稳定哈希分桶 a/b）与 `qShareText(mod, sid)`：
  - a=好奇型：「我刚做了一道题，你能做对吗？答完就能看到大家选了啥」
  - b=挑战型：「敢不敢挑战这道题？不少人都做错了，答完立刻看你击败了多少人」
  - 链接带 `&v=a|b` 用于落地页归因。
- `share-q.vue` 落地页：读取 `v` 参数，`share_open`/`share_answer` 事件 source 记 `share_a`/`share_b`（无 v 保持 `share`），二次转发复制文案改用 `qShareText`（桶一致）。
- `q-social-bar`（练习页分享）与错题本 `book.vue` 分享：复制文案改用 `qShareText`，`share_copy` source 记 `qbar_a/b`、`book_a/b`。
- 练习完成页「晒成绩」补埋点 `share_result_copy`（后端 track 白名单已加）。

漏斗对比口径：`share_copy(…_a/…_b)` → `share_open(share_a/b)` → `share_answer(share_a/b)`。未新增外部渠道，未动现有分享机制（答题/统计/组队邀请/CTA 均保留）。

生产验证：新 bundle 含 A/B 文案；`POST /api/track share_result_copy` 200 入库（探针记录已清理）。

## 3. access log 周报 cron 化

- 新增 `deploy/cron_access_report.sh`：聚合 `/var/log/caddy/kaogong.zalize.com-access*.log*`（`zcat -f` 兼容轮转 gz、日志缺失时写占位说明），管道给 `scripts/access_log_report.py - --days 7`，输出 `/home/ubuntu/kaogong-reports/access-weekly-YYYYMMDD.txt`（0664，仅聚合统计，无 UA 原文之外的敏感信息、不 echo 环境变量）；周报保留 90 天。
- 服务器 crontab（ubuntu 用户）新增：`0 8 * * 1 /home/ubuntu/kaogong-assistant/deploy/cron_access_report.sh # kaogong-access-weekly`（服务器时区 Asia/Shanghai，周一 08:00 CST = **周一 00:00 UTC**）。
- 依赖文件已同步到服务器：`scripts/access_log_report.py` 与 wrapper（注：`deploy_h5.sh` rsync 不含 `scripts/` 目录，后续如改动该脚本需手动同步，已记录）。
- 验证：手动执行 wrapper 成功产出首份周报（147 请求 / /tiku/ 31 / 爬虫 0），`crontab -l` 确认条目在位。

## 4. 部署与回归（deploy_h5.sh）

- 1/6 构建 → 2/6 .env 预检 ✅ → 3/6 rsync（排除 .env）→ 4/6 重建容器（ADMIN_TOKEN 校验✅）→ 5/6 线上 bundle 与本机一致（`index-CunZgeV0.js`）→ 6/6 回归 7 项全 200（/api/stats、yanyu/changshi 题目、/tiku/、/robots.txt、/indexnow-key.txt、/admin）。
- Flutter `flutter analyze` ✅（本轮无 Flutter 改动，健康复跑）。

## 5. 遗留与建议

- LLM_API_KEY / ACCESS_CODE 仍待老板补发，AI 功能保持降级（未接任何新渠道）。
- 小程序分享文案未同步 A/B（本轮 H5 优先），可下轮复刻。
- A/B 漏斗数据建议 1-2 周后复盘（当前自然流量小，样本积累慢）。
- `scripts/` 目录不在 deploy_h5.sh 的 rsync 清单内，周报脚本改动需手动同步或后续把 `scripts` 加入清单。
