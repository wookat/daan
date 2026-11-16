# R363：按卷练习中断续练保留归卷 source 与卷名

## 取证（verified，2026-08-29）

- 生产 rev `644d31b`（R362 已上线）。按卷练习（untimed paper session）在 `startPaper()` 内设置
  `this._source = untimed ? (p.source || null) : null`（R361），作答时 `answer_log.source` 归卷。
- 但中断续练两条恢复路径均不还原 `_source`：
  - 本机：`saveSession()` 写 `pendingSession`（items/idx/right/streak/lastModule/lastSubmodule），不含 source；
    `adoptLocalPending()` 不设 `_source` → 恢复后 `_source` 为 undefined，续答的 `answer_log.source` 为 null。
  - 跨设备：`collectPracticeProgress()` payload 无 source；`practice_progress` 表无对应列；
    `adoptPracticeResume()`/`adoptRemoteSnap()` 均不还原 → 同样丢失归卷。
- 首页续练卡与「继续上次练习？」弹窗对按卷会话显示「上次练习 · 已做 X/N 题」（`lastModule=null`，
  `prModName` 回落通用文案），用户无法知道这是哪张卷。

即：R361 建立的「按卷练习 answer_log 归卷」语义在**任何一次中断恢复后即失效**；且续练卡对按卷会话无卷名可辨识。

## source of truth

- 会话的归卷 source = `startPaper()` 时传入的 `p.source`（卷库卡片 `psource`）。
- 卷名 = `p.title`。
- 两者都是会话属性，应随进度快照（本机 `pendingSession` + 服务端 `practice_progress`）一起持久化并在恢复时回填。

## 最小修复设计

后端（零破坏、旧客户端零变化）：
- `practice_progress` 表 PRAGMA 守卫补 `psource TEXT`、`ptitle TEXT` 两列（同 R317/R318 exam_progress 模式）。
- `save_practice_progress()` 增 `psource`/`ptitle` 可选参数并写入。
- `POST /api/practice/progress` 接受可选 `source`（trim ≤64）/`ptitle`（trim ≤80），非字符串忽略（fail-closed 存 None）。
- `GET /api/practice/resume` 返回体补 `source`/`ptitle`。

前端：
- `collectPracticeProgress()` 增 `source`/`ptitle` 参数（仅非空字符串截断输出，否则 ''）。
- `adoptPracticeResume()` 返回体补 `source`/`ptitle`（非字符串回落 ''）。
- practice.vue：
  - `startPaper()` untimed 时 `this._ptitle = p.title || null`；其余 start 路径（start/startReinforce/startDaily 等）置 null。
  - `saveSession()` 的 `pendingSession` 快照补 `source: this._source || ''`、`ptitle: this._ptitle || ''`。
  - `adoptLocalPending()`/`adoptRemoteSnap()` 回填 `this._source`/`this._ptitle`（空串回落 null）。
  - `tryResume()`/`tryServerResume()` 弹窗与恢复入口文案：有卷名时显示卷名。
- home.vue 续练卡：`parsePendingPractice`/`parseRemotePractice` 透出 `ptitle`，卡片副标题优先显示卷名。

不变式：
- timed 模考路径零变化（examProgress 协议独立）。
- 普通练习（无 source）行为零变化：source/ptitle 空串/None，一切文案与现状一致。
- fail-closed：非法 source/ptitle 一律按空处理，不阻塞进度保存。

## 验证

- 后端 pytest：progress POST 带/不带 source/ptitle 的存取回读、resume 透出、非法类型忽略。
- 前端 vitest：collect/adopt/parse 纯函数新字段边界。
- 生产 UI：按卷练习答 2 题→退出→首页续练卡显示卷名→继续→再答 1 题→DB 验证该题 answer_log.source=卷 source。
