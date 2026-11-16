# R352：错题本复习会话跨设备同步——review_cur 单快照 + /api/review/cur

## 取证事实（verified，2026-08-29）

- R351 的 `reviewSnap` 仅存本机 `uni.setStorageSync`（grep 全 src 仅 book.vue 三处引用），换设备/清缓存后中断的复习会话不可恢复；
- 站内同类"进行中状态"均已服务端化：普通练习 practice_progress（R322）、模考 exam_progress（R298）、AI 进行中会话 ask_cur（R332，uid 单快照 last-write-wins 模式）；复习会话是最后一个只有本机快照的中断态——资产语义不一致（同 R332 立项逻辑）；
- 复习会话含已答态/加练条目等纯前端状态，服务端只需原样保存快照 blob（对齐 ask_cur 的 items blob 模式，而非 practice_progress 的逐字段模式——加练条目含完整题面，无法只存 qids 重查）。

## 方案（复用 R332 ask_cur 单快照模式，零 UI 变化）

后端：
- 新表 `review_cur (uid TEXT PRIMARY KEY, snap TEXT, updated_at INTEGER)`，db.py save/clear/get 三函数（_ensure 惰性建表，与 ask_cur 同构）；
- `POST /api/review/cur`：body `{uid, snap}`；`snap` 为 null/缺失 → 清除；否则服务端 fail-closed 校验：dict、`v==1`、`snap.uid==uid`、ts 正整数、items 为 1–80 条且每条 dict 含非空字符串 question_text、rIdx 整数且在界内；序列化 >200k → 400；`rl(request, "rcur", 120, 3600, uid)`；
- `GET /api/review/cur?uid=`：TTL 2 小时（对齐前端 parseReviewSnap 的 TTL），过期/无记录返回 `{}`，否则原样返回快照对象（前端仍再过一遍 parseReviewSnap 二重 fail-closed）。

前端（book.vue，review-snap.js 零改动）：
- `saveReviewSnap()` 本机写成功后去抖 1.5s 回传 POST（失败静默，非关键路径）；
- `clearReviewSnap()`（放弃/完成复习/退出）同时 POST `snap:null` 清服务端；
- `onShow` 恢复顺序：本机快照优先（命中则 0 GET）；无本机才 GET 远端，应答直接走既有 `parseReviewSnap`（uid 绑定/TTL/畸形全部复用 fail-closed），命中才出 R351 横幅。竞态守卫：回填前重查 `reviewing`/`resumeInfo`/本机快照。

## 非目标

- 不做多设备并发合并（单快照 last-write-wins，同 ask_cur 口径）；
- 不改 R351 横幅 UI/埋点、不改 SRS/requeue 语义、不加新埋点。

## 验证计划

- pytest：POST 合法保存/空清除/7 类非法 400（缺 uid、非 dict、v 错、uid 不符、items 空/超 80/坏条目、rIdx 越界、超大）/GET TTL 过期空应答/round-trip；
- vitest：既有 review-snap 测试覆盖远端应答解析（同函数）；
- 生产：curl API 逐项 + testing agent 双设备实测（A 设备中断→B 全新 context 无本机快照 GET 回填出横幅→继续复习原位恢复；A 放弃后 B 空态）。
