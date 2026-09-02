# R302 设计方案：模考成绩报告补「目标分对比 + 较上次同卷」个人锚点

## SOP-10 取证（一手证据）

四维复审计（对标粉笔模考报告）后锁定「核心功能深度」维度缺口：

- 用户学习画像早已收目标分：home.vue 制定学习计划三步收 `target_score`，服务端 `user_profile.target_score`（study_api.py `POST /api/profile` 0–100 白名单，`GET /api/profile` 返回），计划页/教练建议已消费。
- 模考大赛赛后报告（contest-report.vue）已有「距离目标」卡：`目标分 Y → 已达标 🎉 / 还差 Z 分`（r.target_score/gap_to_target），证明该锚点在本产品内已成立。
- 但**日常模考成绩报告（report.vue，使用频次远高于大赛）完全不消费学习画像**：hero 只有分数/正确率/用时，历次成绩曲线（history，同卷倒序转正序）只画柱不给「较上次 ±X 分」结论——用户每次模考后无法一眼回答「离我的目标还差多少」「比上次进步了没」。
- 竞品：粉笔模考报告核心复盘锚点即「本次 vs 目标 / vs 上次」趋势结论，不止曲线。

用户可感知痛点：设了目标分的用户交卷后要自己心算差距；同卷二刷后要自己对比柱状图读进步幅度。

## 方案（纯前端最小收口，零后端改动）

新共享纯函数 `frontend-uni/src/exam-goal.js`：
- `goalGap(score, target)`：target 非法/未设/≤0 或 score 空 → null；否则 `{ target, gap }`（gap=target−score，1 位小数）。
- `prevScoreDelta(history, curId)`：history（正序）中定位当前 attempt，无前一次 → null；否则 `{ prev, delta }`（1 位小数）。

report.vue：
1. load 时并行拉 `GET /api/profile?uid=`（失败静默，targetScore 置 null 不渲染）。
2. hero-meta 补「较上次同卷 +X/−X 分/持平」（仅同卷有前次 attempt 时渲染）。
3. rank-card 下补「距离目标」卡（对齐 contest-report gap-row 视觉/文案）：`目标分 Y → 已达标 🎉 / 还差 Z 分`；未设目标分不渲染不引导伪造。

不做：不动后端/报告契约；不做 top25 线（日常卷样本极少，与大赛口径不同）；不改历次成绩曲线。

## 验收
- 1440×900 与 375×812：设目标分 uid 报告目标卡与「较上次」文案正确；未设目标分 uid 两处均不渲染；同卷仅一次 attempt 不显「较上次」；溢出 0、console 0 error、性能预算过。
- 生产真实接口种子（profile 设目标分 + 同卷两次模考）验证后测试 uid 全库清理 leftover 0。

## 测试
- vitest：goalGap（null/0/负/字符串 target、达标/未达标、小数舍入）、prevScoreDelta（空/未命中/首次/正常/小数）。

## 反伪造边界
目标分只来自用户自设画像；「较上次」只来自同卷真实 attempts；缺数据一律不渲染。
