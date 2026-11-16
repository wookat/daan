# R293 设计：申论真题收藏闭环——详情页星标 + 真题 tab 收藏视图 + ?fav=1 深链

## 取证（verified，一手源码/生产实查）

- 申论真题列表卡已有星标（`toggleQFav`，slQFavIds 只存 id），但收藏后**全站无任何查看入口**：真题 tab 无收藏视图、素材 tab 收藏视图只覆盖素材、收藏与笔记页（favorites.vue）只覆盖行测题——收藏行为是「有去无回」的死数据。
- 详情页（作答页）零收藏出口：用户读完题/作答后想留存，必须返回列表找到卡片再点星标。
- 素材侧早已闭环：favIds+favMats 快照、收藏 chip 视图、?tab=m&fav=1 深链（R268）。真题侧与素材侧口径不一致。
- 对标粉笔：申论真题页具备收藏与收藏夹回看能力。

## 方案（最小复用，纯前端）

1. 纯函数 `shenlun-qfav.js`：`toggleQFav(state, q)` 同步维护 id 列表 + 展示快照（头插、上限 200、不可变），`missingSnapIds` 找出历史只存 id 无快照的收藏。
2. 详情页 q-top-r 补星标（aria 收藏/取消切换），与列表卡同构。
3. 真题 fltbar 补「收藏 N」chip → qFavOnly 视图（渲染 qFavs 快照，点卡直达详情）；任何筛选操作（题型/年份/地区/套卷/重置）退出收藏视图，与素材 setMtype 行为一致。
4. 历史存量兼容：进收藏视图时对缺快照 id 补拉 `/api/shenlun/questions/{id}`（≤20 个，失败不阻断）。
5. URL：`buildShenlunFilterUrl` 增 fav 参（`?fav=1` 不叠其他筛选，与素材一致）；onLoad 无 tab（或 tab=q）时收 `?fav=1` 恢复收藏视图。

## 不改

素材收藏链路、行测收藏页、后端全部接口、`/api/shenlun/mat_favs`（真题收藏暂不做服务端同步——素材侧有 mat_favs 表，真题侧无对应表，本轮不加 API，挂候选）、SSR 页族、URL 恢复协议其他分支。

## 验证

- 本地：lint / vitest（新增 shenlun-qfav 6 例 + shenlun-url fav 1 例）/ H5 build 全绿。
- 生产 1440/375：列表星标收藏 → chip 计数、收藏视图仅收藏项、详情页星标收藏/取消、?fav=1 深链恢复、筛选操作退出收藏视图、刷新后快照保持、溢出 0、console 0 error、性能预算。
