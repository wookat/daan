# R287：卷库列表「未交卷模考」续考横幅

## 取证（源码 + 生产行为实查）

- exam.vue 已有中断保护：onHide/onUnload 落 `examProgress` 本地进度（attemptId/paperId/mini/items/idx/endAt），但恢复入口只在 onLoad 且要求再次进入**同一张卷**（`opt.paper_id === saved.paperId` 或同为 mini）才弹「继续上次模考？」。
- 用户中途离开后回到卷库列表（最常见路径），全页零续考入口——必须自己记住是哪张卷并重新点开才有机会恢复；mini 模考更是只有重新点「迷你模考」才会触发。粉笔卷库对未完成模考有显著「继续」横幅。
- 过期进度（endAt 已过）会永久残留在 storage：exam.vue 仅在匹配进入且用户选「重新开始」时清除。

## 方案（纯前端，不改 exam.vue 恢复协议）

1. `exam-resume.js` 纯函数 `parseExamProgress(saved, now)`：校验 attemptId/items 数组非空/endAt>now，产出 `{ paperId, mini, title, answered, total, leftSecs }`；无效/过期返回 null。title 回落「迷你模考」/「真题模考」。
2. `list.vue` onShow 读取 storage 渲染顶部续考横幅：卷名 + 已答 x/n · 剩余 m:ss + 「继续模考」（navigateTo exam?paper_id=/mini=1，命中 exam.vue 既有恢复弹窗）+ 「放弃」（confirm 后 removeStorageSync）。
3. 过期进度顺手清除，不再残留。
4. 边界：倒计时为静态快照不走秒级刷新（横幅是入口不是考试界面）；交卷成功后 exam.vue 已清 storage，回列表横幅自然消失。
