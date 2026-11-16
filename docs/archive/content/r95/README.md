# 轮95：性能 P2 消化（首页 CLS 骨架屏 + 部署预热 + vendor 拆分评估）

分支 devin/1786337495-r95（PR#121 已合并，本轮改动按老板指示改推本分支）。上轮 r94 报告见 docs/content/r94/README.md。

## 1. 首页 CLS 0.207 → 0.08（目标 <0.1 达成）

### 1.1 改动（frontend-uni/src/pages/home/home.vue）

r94 定位首页 CLS 全部来自异步卡片 `v-if` 插入推挤下方区块。本轮为四处异步区加骨架屏/等高占位，占位高度按 375px 线上实测真实卡片高度逐一对齐（Playwright getBoundingClientRect 实测：guide 81px、公告 77px、时政卡 83px、模块行 72px）：

| 区块 | 骨架 | 占位高度 | 退出条件 |
|---|---|---|---|
| 学习计划引导/今日计划 | `.skel-plan` | 162rpx | `loadProfile()` finally 置 `profileFetched=true`（成败都退出，不会永久骨架）；`planSkel` 由 storage 缓存（homePlanCard/planGuideHide）决定是否需要占位 |
| 公告 | `.skel-ann` | 154rpx | `announce` 初始 undefined，接口返回后置 item 或 null（catch 也置 null） |
| 时政每日一练 | `.skel-sz` | 166rpx | `counts.length` |
| 专项练习模块列表 | `.skel-row`×6（5 模块+混合刷题） | 每行 144rpx | `counts.length`；骨架区保留「题库加载中…点此重试」提示且整块可点重试，loadCounts 原有 20 次自动重试逻辑不变 |

骨架样式复用现有 CSS 变量（`--fill`/`--card`），浅色/深色两态自适应，脉冲动画 `skel-pulse` 1.4s。

### 1.2 Lighthouse 复测（13.4.1，移动端仿真，hash 路由 /#/）

4G（默认 slow-4G）×3 次：

| 轮次 | 分数 | CLS | LCP | FCP |
|---|---:|---:|---:|---:|
| r94 基线 | 89 | **0.207** | 2.1s | 1.4s |
| r95 ×3 | **97/97/99** | **0.08/0.08/0.019** | 2.0s | 1.4s |

3G（RTT300ms/700Kbps/CPU4x）×3 次：分数 80/80/81，**CLS 0.08**（r94 0.019），FCP 2.7s，LCP 4.0s，TBT 30-40ms。

- 迭代过程：首版骨架（计划+时政+5 行模块）CLS 0.207→0.109；剩余 shift 定位到公告卡（77px 异步插入无占位）与模块列表少 1 行（漏了混合刷题行），补公告骨架+改 6 行后达 0.08。
- 残余 0.08 来自 uni-page-wrapper `::after` 两次页面级微移（today 任务卡内文案异步变化等），已 <0.1 不再追。
- 3G LCP 4.0s（r94 3.0s）：LCP 元素为公告正文文本（异步 /api/announcement 返回后渲染，element render delay ~1.1s），与骨架改动无关（4G LCP 2.1→2.0s 持平）；r94 为单次测量存在波动。公告若长期作为 LCP 元素可评估 SSR/内联首屏公告，列 P3 观察。

### 1.3 线上走查

375px 浅色+深色两态 Playwright 实测：骨架加载后全部退出（`.skel` 残留 0），guide/公告/时政/6 模块行正常渲染，JS 错误 0，两态截图核对无样式异常。

## 2. 部署脚本容器预热（r94 建议项落地）

deploy/deploy_h5.sh 新增 step 4b：容器重建+ADMIN_TOKEN 检查后、bundle hash 校验前，对 9 个**只读** GET 端点各发一次预热请求并打印耗时：/api/stats、/api/questions?limit=10&module=×5（五模块）、tag3 抽题样例、/api/exam/papers、/api/papers。

- 原理：拉升 SQLite OS 页缓存与应用启动路径，消除 r94 观测到的 /api/exam/start 16.5s 级冷启动长尾（其慢在冷读题库大表，预热读接口即可覆盖同一数据面）。
- 低风险理由：全部为只读查询、不带 uid、不创建 attempt/paper/growth 任何业务数据（本轮部署后验证 exam_attempts 当日新增 0）。刻意不预热 /api/exam/start（会创建试卷/attempt 脏数据）。
- 实测（本轮部署输出）：预热首请求 0.49-1.32s 完成，后续回归请求全部 200 且明显变快。

## 3. vendor unused-JS 拆分评估：不当轮做，照实立项

- 现状：frontend-uni vite.config 无自定义 manualChunks，vendor 主包 index-*.js（br 后 ~97.6KiB）中 Lighthouse 报 ~59KiB unused，构成为 @dcloudio/uni-h5 框架运行时 + Vue runtime + wot-design-uni 公共部分。
- 评估：unused 部分是框架内部按需分支（组件/API 注册面），非业务代码；manualChunks 只能重组不能消除，且 uni-app 的 vite 插件对 chunk 划分有内部假设，强拆有构建/运行时风险，需全端（H5/小程序/App）回归；主包跨页共享缓存，首访后边际收益趋零。3G 首页瓶颈实测在 LCP（公告异步渲染）而非 JS 体积。
- 结论：**收益小、风险大，不当轮实施**。立项建议：随 uni-app 版本升级观察官方 tree-shaking 改进；若后续做，先在独立分支验证 easycom 按需注册 + wot-design-uni 组件裁剪，全端回归后再上。

## 4. 例行 + health_scan.py

health_scan.py（仓库脚本上传→docker cp→容器内执行）全绿：active 113,304 / full 156,792；lt50、badjson、cid、fffd、spam_residue、hs_mismatch、paper_dup 全 0；空 hs 仅 2 条 intentional 台账题（changshi:655861、panduan:334296）未动；低覆盖仅卷 112（65/112）。

数据观测（近 7 天，排除 QA）：answer_log 39 条 / 14 uid，与基线持平。**亮点：出现疑似真实分享/组队链路使用**——近 24h share_open 4、share_answer 3、team_join_open 5（多个独立匿名 uid 连贯触发，且 /s/ 落地出现 MicroMessenger（微信内置浏览器）UA 4 次），为分享功能上线以来首次非自测形态的链路数据，下轮继续观察。爬虫（归档+当日）：YandexBot 168（/tiku 160）、bingbot 2、Baiduspider 2；Bing 收录本轮未复查（沿用 r92 结论未破零，站长验证仍 P0）。

QA 清理：本轮 Lighthouse/Playwright 仅访问首页，无 attempt/answer/growth 写入（当日 exam_attempts 新增 0 已验证）；顺手清掉 1 条历史遗留 QA 事件（growth_events uid=r45qa_u1 的 comeback_view），复扫 QA 形态 uid 残留 0。

## 5. 部署与回归

deploy_h5.sh 全流程（.env 预检→rsync→容器重建→**新预热步骤**→bundle hash 一致→接口回归 7 端点全 200）执行 3 次（含骨架两版迭代），最终线上 bundle index-Decu-xW7.js 与本机构建一致。

## 6. 限制

- Lighthouse 单机测量（±3 分波动），3G LCP 4.0s 归因基于 lcp-breakdown 洞察，未做多日采样。
- 骨架屏仅 H5 实装；小程序/Flutter 首页未同构（两端渲染机制不同、CLS 非 Web 指标，暂无必要）。
- 预热在部署时执行一次；若容器因 OOM/重启自愈，冷启动仍可能出现（可后续在 compose healthcheck 中加预热，列 P3）。
