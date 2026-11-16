# 轮85：exam-report 无参空态修复 + 推广残留检测沉淀进健康快扫 + 例行

分支 devin/1786326754-r83（PR#119）。代码变更两处：`frontend-uni/src/pkgA/exam/report.vue`（H5 空态）、新增 `scripts/health_scan.py`（健康快扫脚本入库）。生产内容变更 1 题（§2 残留清理）。

## 1. exam-report 无参空态（r84 P2 消化）

- **H5**：`report.vue` onLoad 无 attempt_id 时不再发起 `/api/exam/report/undefined`（原 422 来源），直接显示空态卡「暂无成绩报告 + 去卷库」按钮。deploy_h5.sh 部署上线。
- 线上复验：无参直开 `pkgA/exam/report` → 空态渲染、**0 个 4xx 请求、0 console error**；带真实 attempt_id 正常流程复验（QA attempt 走完 start→submit→报告页）——分数卡/模块得分/薄弱考点/逐题解析全在位，不回归。QA attempt 已清理（残留 0）。
- **小程序**：`pages/exam/report.ts` 已有守卫（缺参 toast+navigateBack），无需改动。
- **Flutter**：路由 `/exam/report/:id` 必带路径参数，无无参入口，无需改动。

## 2. 内容防回流：推广残留检测沉淀进周期健康快扫

- 新增 `scripts/health_scan.py` 入库（此前健康脚本存在生产 /tmp，容器重建曾丢失过一次）：整合历轮官方口径——active/full、<50、options 非 JSON、(cid:)/U+FFFD 乱码、hs 一致性（多选字母集合）、空 hs（白名单仅 2 条 intentional 台账题）、卷内重复、低覆盖率卷、近7天活跃、growth；**新增 OCR 推广残留检测面**（gwyeasy / gwy288 / 「公众号：樱有尽有」/「获取…更新，请关注公众号」四条精确模式，不误伤题目语义中的正常「公众号」字样）。
- 沉淀即见效：加宽后的模式扫出 r84 漏网 1 题（261400，panduan，解析头部「杨柳（微信：gwy288）提示…」变体，r84 正则要求带公众号字样故未命中）。备份 `/data/bak_r85_spam1.db` → 守卫事务仅删该推广句（争议题说明与两版解析正文保留）→ rescore → 复扫 **spam_residue 0**。守卫断言：active/full 计数不变、两条 intentional 空 hs 逐字未动。

## 3. 例行数据 / 爬虫 / 健康快扫

- 健康快扫（scripts/health_scan.py 生产实跑）全绿：active 113,304 / full 156,792；<50、非 JSON、(cid:)、U+FFFD、hs 一致性、台账外空 hs、卷内重复、推广残留全 0；低覆盖率卷仅 112（58.0%，存疑台账待权威题源）。
- 近7天：39 作答 / 14 uid，与基线持平；growth 台账不变（share_open 5、team_join_open 5、heatmap_view 4 等）。
- 爬虫（当日 live log）：YandexBot 83 + bingbot 1 + Baiduspider 1；/tiku/y* 57、/tiku/papers* 10 持续到访；/s/ 累计 12 次仍全为自测+扫描器，另 YandexBot 抓 /s/ 1 次。Bing 收录仍未破零（站长验证仍为外部 P0 依赖）。
- 部署回归 7 端点全 200；线上 bundle hash 与本机构建一致。

## 4. 限制与下轮建议

- 空态修复为 H5 单端小改，未做 320px/桌面全三态走查（改动为纯新增分支，正常流程已实测不回归）。
- 建议：health_scan.py 后续可接入 cron 周期跑并归档输出；存疑台账 603 条 + 卷 112 待权威题源；/s/ 真实落地与站长验证继续例行观测。
