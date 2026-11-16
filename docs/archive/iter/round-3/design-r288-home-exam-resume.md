# R288：首页外显「未交卷模考」续考入口

## 取证（源码 + 生产行为实查）

- R287 已在卷库列表加续考横幅，但覆盖面只有 /pkgA/exam/list 一页；中断做卷后最常见的回流路径是首页（tabbar 默认落点、推送/深链归一化落点），首页对未交卷进度零外显。
- 首页已有同构的召回横幅体系（comeback 回访卡、reminderBanner 打卡提醒卡），未交卷模考是三者中时效最强、损失最大的场景（倒计时仍在走、进度会过期），却缺位。
- 粉笔首页对进行中模考有「继续」入口。

## 方案（纯前端，复用 R287 exam-resume.js，零新协议）

1. home.vue onShow 读取 examProgress，`parseExamProgress(saved, Date.now())` 有效则渲染横幅；无效/过期顺手清 storage（与 list.vue 行为一致）。
2. 横幅沿用首页召回卡视觉（cbcard 同构）：标题「有一场未交卷的模考」+ 副文案（卷名 · 已答 x/n · 剩余 m:ss）+「去继续 ›」（navigateTo exam?paper_id=/mini=1，命中 exam.vue 既有恢复弹窗）+ ✕（confirm 后 removeStorageSync，与 list.vue 放弃语义一致，不做静默关闭以免误解为「稍后还在」）。
3. 位次放在回访卡/打卡提醒卡之前（时效最强）。
4. 边界：剩余时间为进入首页时的静态快照；交卷成功后 exam.vue 已清 storage，横幅自然消失；不改 exam.vue 恢复协议、不加 API、不伪造数据。
