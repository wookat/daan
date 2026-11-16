# R283 设计方案：模考成绩报告「邀考友挑战本卷」分享出口

## 取证（一手证据）

1. 生产站 `report.vue` 源码实查：`grep 分享|share|海报` 零命中——模考成绩报告是全站主要成果页中唯一没有任何分享出口的页面（练习完成页有分享海报、PK 有 /p/{rid} 短链战绩、小队有邀请/周战报复制、搜索/申论详情有复制本题链接）。
2. 粉笔公开能力对标：粉笔模考交卷后报告页提供「晒成绩/邀好友同考」分享，是模考场景的核心传播出口。
3. 抗截断落点已存在：R278 后真题卷 SSR 页 `/tiku/papers/{id}`（无 hash/query，聊天应用不截断）自带 OG 标签 + 「在线模考本卷 →」CTA 直达做卷深链，收到分享的考友打开即可同卷模考；`rank-card` 已按同卷排名，「同卷挑战」有真实比较语义。
4. 契约边界：`/api/exam/report` 已返回 `paper.id/title/kind`；SSR 卷详情页仅对 `kind == "zhenti"` 提供（`seo/pages.py:371`），迷你模考卷（mini）无公开落点。

## 方案（最小、聚焦、纯前端）

- 新增纯函数 `frontend-uni/src/exam-share.js`：
  `buildExamReportShareText(report, origin)` →
  - `report.paper.kind !== 'zhenti'` 或缺 `paper.id/title` → 返回 `''`（mini 卷不外显分享）；
  - 否则返回 `我在错题邦模考《{title}》答对 {correct}/{total} 题，敢来挑战吗？同卷在线模考：{origin}/tiku/papers/{id}`。
- `report.vue`：hero 卡下（rank-card 附近）新增「邀考友挑战本卷」按钮（`role=button` + aria-label，对齐既有 copy 控件），点击 `uni.setClipboardData` 复制文案 + toast + `trackEvent('share_copy', 'exam_report', paper_id)`。
- 不改后端、不加 API、不改 SSR、不动 practice/exam 页。

## 验收

- vitest：zhenti 正常文案、mini/缺字段返回空、origin 拼接。
- 本地 lint/vitest/build 全绿（后端零改动，照跑基线）。
- 生产：真实种子模考（zhenti 卷）报告页按钮可见，点击剪贴板实读文案与链接（目标 SSR 页 200）；mini 卷报告不显示按钮；1440/375 溢出 0、console 0 error；性能预算全过；测试数据清理。
