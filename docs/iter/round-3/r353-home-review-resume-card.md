# R353：首页「未完成错题复习」续复习卡——本机快照优先 + review_cur 服务端 fallback + 直达自动恢复

## 取证（verified）

- 首页已有「未交卷模考续考卡」（R288，examResume）与「未完成练习续练卡」（R323，practiceResume），中断进度在默认回流入口可见可续可弃。
- R351/R352 后错题本复习会话已有本机快照 reviewSnap + 服务端 review_cur，但**唯一外显入口在错题本页内**：用户回流首页时完全看不到「有一次复习没做完」，必须主动点进错题本 tab 才能遇到恢复横幅——与模考/练习的召回口径不一致，2 小时 TTL 内召回窗口被白白消耗。

## 方案（对齐 R323 同构，纯前端 + 埋点白名单 1 行，零新 endpoint/表/协议）

### home.vue
- data 补 `reviewResume`，onShow 调 `loadReviewResume()`：
  - 本机优先：`parseReviewSnap(uni.getStorageSync('reviewSnap'), anonUid(), Date.now()/1000)` 命中即显卡、零远端 GET；
  - 无本机才 `GET /api/review/cur?uid=`，返回 payload 再过一层 `parseReviewSnap()`（与 book.vue restoreRemoteSnap 同口径 fail-closed）；
  - `rvClearedAt` 30 秒窗口防「刚放弃又被远端回填」（同 ppClearedAt 口径）。
- 卡片复用 ercard 样式：「有一次未完成的错题复习 · 第 X/N 题」+「去继续 ›」+「✕」。
- `rvContinue()`：trackEvent('home_review_resume_click') → 写 `bookReviewIntent` storage 握手 → `switchTab` 错题本（book 是 tab 页，不能 navigateTo）。
- `rvDrop()`：showModal 确认 → 清本机 reviewSnap + 记 rvClearedAt + `POST /api/review/cur {snap:null}` 清服务端（失败静默）→ 卡片消失。

### book.vue（消费端）
- onShow 读取并**消费即删** `bookReviewIntent`；非复习态且 `resumeInfo` 已命中（本机路径）→ 直接 `resumeReview()` 原位恢复，跳过横幅二次点击；
- 本机未命中走 `restoreRemoteSnap()` 异步路径时，intent 存入 `_reviewIntent` 一次性标记，GET 回填成功后自动 `resumeReview()`（fail-closed：远端也无合法快照则 no-op，落在正常错题本页）；
- `resumeReview()` 原有 `review_resume_click` 埋点、恢复语义零改动。

### 后端
- team.py /api/track 白名单 +1：`home_review_resume_click`（R347 契约测试 test_track_whitelist_sync 自动覆盖前端在发事件）。

## 边界

- uid 单快照 last-write-wins、2h TTL、fail-closed 校验全部复用 R351/R352，不新增协议；
- 不做多设备并发合并；
- intent 为一次性消费，直开错题本不受影响。

## 验证清单

本地 lint/vitest/build + ruff/pytest/pyright；生产双设备：A 中断复习回首页出卡→去继续自动原位恢复；B 全新 context 首页出卡（服务端 fallback）→去继续跨设备恢复；放弃后双端卡与横幅消失、review_cur 0 行；R351/R352/R288/R323 回归；0 次 /api/explain；测试 uid 清理 + 保护 uid 前后一致。
