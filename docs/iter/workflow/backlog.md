# 迭代工作流台账（workflow backlog）

> 每轮（W*）结束时：勾掉本轮已完成工作项，追加本轮 deferred；下轮开工先读本文件与对应 w*.md，不重复立项。

## 已完成

- [x] R348-B1（W1，P0，backend）账号 uid 归属守卫补洞（Content-Type 大小写 + multipart scan_sheet）、写接口畸形数字 400、连签口径统一 —— 已合入 `devin/wf-w1-integration`，本地全绿 + uvicorn 实测；生产回归待部署后做（见 w1.md §5）
- [x] R348-C1（W1，P0，content）下线 SKIP/数据矛盾题与伪中文 yanyu AI 批次、剥离 hs 管线括注，规则入 quality.py 与 hs 导入口 —— 代码与脚本已合入；临时库 dry-run/apply/复扫一致；**生产 `--apply` 未执行**（需部署后由负责人确认备份路径，且需先决策 `数据矛盾` 词表误杀问题）
- [x] R348-M1（W1，P1，miniapp）海报操作区 `.bar`→`.actions`、账号 uid 403 清登录态回退匿名、刷题页渲染题图可预览、分享页模块名中文 —— 已合入；typecheck + lint（`ESLINT_USE_FLAT_CONFIG=false`）全绿；真机/开发者工具走查未做（无 Linux 版）

## Deferred（W1 追加）

- [ ] [frontend-h5 打包·下轮直接消费·P2] 三处一行修：a) `stats.vue:543` / `reminder.js:41,74` / `pkgA/settings/reminders.vue:119` 用 `toISOString().slice(0,10)`（UTC）读 pstats.days，而写入用 `checkin.js dayKey`（本地日）——北京时间 00:00–08:00 统计 7 日趋势「今天」与提醒进度错位一天，统一 import dayKey；b) `practice.vue:2` `has-banner: picked` 但 `:337` banner 在 beiMode 也显示 → 背题模式底部无留白被固定条遮挡，改 `picked || beiMode`；c) `home.vue:18/21`「免费刷 11万+ 行测真题 / 11万+ 真题题库」——生产在线 113107 题中 is_real=1 仅 15872，建议改「11万+ 行测题库 · 1.5万+ 历年真题」。验收：`cd frontend-uni && npm run lint && npm run build:h5`，生产 375/1440 走查。
- [ ] [content 后续·P1] yanyu b2026* 剩余 2882 条（命中 <3）及其他模块同批次在线题（changshi 10405 / shuliang 9450 / panduan 2506 / ziliao 860）质量未抽检；建议用既有 `/api/admin/batches/{bid}/sample` + sample_reviews 按批次 10 题抽审并 decide，或引入现成中文流畅度模型（perplexity 打分）替代正则作主判、正则只做兜底。
- [ ] [content 复核·P2] 17 条「数据矛盾/官方解析有误」题下线后，需人工核对是否为 hs 生成误判（可能题干含图表数据未 OCR），确认后可恢复并补图。W1 生产 dry-run 补充：`数据矛盾` 单独触发 12/17，其中至少 6 条（#379008、#3341、#266005、#331750、#412484、#329505）为正常解析用法，apply 前先决策词表。
- [ ] [backend 设计题·P2] quality_score 目前仅 admin 排序用（`db.py:1740-1749`），random_questions/daily_set 不参考；是否让低分（如 <40）题默认不进抽题池，需先统计各分段真实错误率再定阈值，勿拍脑袋。
- [ ] [未复现·待证据] 首访计划/刷题「60 秒等待」：生产 `/api/questions` 0.38s、`/api/home_bundle` 0.30s；handoff R14 记有「学习日历分包 Async component timed out 偶发 60s」，更可能是 H5 分包首载/SW 预缓存问题而非后端；需前端 performance 资源时序截图再立项。
- [ ] [新需求·竞品] 两套模考入口合并、原生导航字体统一、错误态文案统一属 P2/P3 体验项，本轮未复核证据，下轮由 UX 走查带截图立项。
- [ ] [新需求·内容] hs_explanation 中「官方解析误将…」类纠错信息有价值，可在 quality 治理后单独抽出为「题目勘误」提示而非直接下线（需产品决策）。
- [ ] [新需求·安全巡检] 把 guard_account_uid 三路径回归 curl（application/JSON、无 Content-Type、multipart scan_sheet，uid=u999999 无 token → 403 且不落库）写入 `.agents/skills/testing-kaogong-assistant` 走查清单，每轮上线后跑一次。
- [ ] [工程·P3] miniapp-native `npm run lint` 被仓库根 `eslint.config.mjs`（R213）误切 flat config 报 `Invalid option '--ext'`；package.json 加 `ESLINT_USE_FLAT_CONFIG=false` 或迁移 flat config。
- [ ] [工程·P3] miniapp `api/types.ts Question` 补 `image_credit?: string | null` 类型声明（M1 wxml 透传运行时可用但无类型）。
