# R297 设计：申论作答草稿服务端同步（跨设备可续写）

## 取证（源码一手证据）

- `frontend-uni/src/pkgA/shenlun/shenlun.vue`：作答草稿仅存本机 `slDraft:{qid}`（`saveDraft` 每次 input 写 storage；`openQ` 只读本机；批改成功 `removeStorageSync`）。清缓存/换设备即丢。
- 申论作答是全站输入成本最高的场景（textarea 上限 3000 字、大作文动辄千字），R295 已加限字联动，但草稿仍是设备孤岛。
- 对照口径：R296 后申论真题收藏、素材收藏均已服务端同步 + 匿名归并；批改历史 `shenlun_answers` 早已服务端化。草稿是申论域最后一类不进服务端的用户资产。
- 竞品：粉笔申论作答草稿云端保存，换设备可续写。

## 方案（镜像既有收藏同步模式，零新概念）

### 后端
- 表 `shenlun_drafts (uid TEXT, qid INTEGER, content TEXT, updated_at REAL, PRIMARY KEY(uid,qid))`。
- `db._ensure_sl_drafts / sl_draft_get(uid,qid) / sl_draft_set(uid,qid,content)`：content 空则删行；长度上限 3000（对齐 grade 校验与前端 maxlength）。
- API：`GET /api/shenlun/draft?uid&qid` → `{content, updated_at}`；`POST /api/shenlun/draft {uid,qid,content}` → `{ok}`。校验 uid/qid，uid 截断 64。
- 匿名归并：`shenlun_drafts` 加入 `_UID_PK_TABLES` + `_ensure_sl_drafts(conn)`（账号已有同题草稿时账号侧优先，与其他 PK 表一致）。

### 前端
- 纯函数 `shenlun-draft.js`：`adoptServerDraft(localContent, server)` —— 本机草稿非空一律本机优先（正在写的内容绝不被覆盖）；本机为空且服务端有内容才采用。
- `openQ`：本机草稿即时显示不变；追加 fire-and-forget GET，按纯函数决定是否采用服务端草稿（采用时同步写回本机 storage；晚归响应校验 detail.id 防串题）。
- `saveDraft`：本机即时写不变；追加 1.5s 去抖 POST（失败静默，非关键路径）。
- 批改成功：本机删除不变；追加 POST 空 content 删除服务端草稿。

### 不做
- 不做多端冲突合并/版本向量（本机非空即本机优先，最简且不丢数据）；不改 UI/URL；不缓存该 API（uid 相关，边缘 auth/uid 绕过既有规则已覆盖）。

## 验证计划
- 本地：ruff/pytest（roundtrip/空删/超长 400/参数校验/隔离清理）/pyright/lint/vitest（纯函数 4+ 例）/build。
- 生产：临时 uid 写草稿→实查 API 与库→清本机 storage 刷新→草稿恢复可续写→批改路径不回归→双视口溢出/console/性能预算→测试数据全量清理。
