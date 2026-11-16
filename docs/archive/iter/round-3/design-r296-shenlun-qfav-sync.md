# R296 设计：申论真题收藏服务端同步（对齐素材侧 mat_favs 口径）

## 取证（verified）

- 源码实查 `frontend-uni/src/pkgA/shenlun/shenlun.vue`：
  - 素材收藏 `toggleFav`/`syncFavs`：本地 storage 双写 + `/api/shenlun/mat_favs` 服务端双写，onLoad 时拉服务端合并（本地独有条目回推服务端）。
  - 真题收藏（R293 `toggleQFav`）：仅写本地 `slQFavIds`/`slQFavs`，零服务端同步——换设备/清浏览器缓存即全部丢失，与素材侧口径不一致。
- 后端实查：`shenlun_mat_favs` 表 + GET/POST `/api/shenlun/mat_favs` 已有完整先例；真题侧无对应表（R293 设计文档明确挂候选：「真题收藏暂不做服务端同步——素材侧有 mat_favs 表，真题侧无对应表」）。
- `auth.py` `_UID_PK_TABLES` 含 `shenlun_mat_favs`（登录归并匿名数据覆盖素材收藏），真题收藏不在归并范围——登录后真题收藏不跟随账号。

## 方案（完全镜像 mat_favs 模式，零新逻辑）

后端：
- `db.py`：`_ensure_qfavs`（表 `shenlun_qfavs(uid, qid, created_at, PRIMARY KEY(uid,qid))`）+ `qfav_ids(uid)` + `qfav_set(uid, qid, on)` + `qfav_items(uid)`（JOIN `shenlun_questions` 只取快照字段 id/qtype/paper/exam_year/exam_region/question，过滤 disabled，LIMIT 200 对齐前端 QFAV_LIMIT）。
- `shenlun_api.py`：GET/POST `/api/shenlun/qfavs`，参数校验与 mat_favs 逐行同构。
- `auth.py`：`_UID_PK_TABLES` 加 `shenlun_qfavs` + merge 前 `_ensure_qfavs`，登录归并覆盖真题收藏。

前端：
- `toggleQFav`：本地写后 fire-and-forget POST（`.catch(() => {})`，非关键路径不阻断，对齐素材侧）。
- 新增 `syncQFavs()`：onLoad 与 `syncFavs()` 并列调用；拉服务端 ids+items，本地独有 id 回推服务端，服务端 items 作为快照合并（本地独有快照保留在前），双写回 storage。

不做：收藏视图/星标 UI 零改动（R293 已闭环）；不做删除同步冲突解决（与素材侧一致：本地优先合并）。

## 验证

- 本地：ruff/pytest/pyright + lint/vitest/build。
- 生产 1440/375：收藏→服务端表落库实查、清 storage 刷新后收藏视图恢复（服务端回填）、取消收藏→服务端删除、溢出 0、console 0 error、性能预算；测试 uid 数据验后清理。
