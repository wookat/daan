# R561：错题本「收藏」tab 读侧云端对账（跨设备/小程序收藏在 H5 可见）+ R560-2/3/4 小改——研究先行

日期：2026-09-09。生产 rev `9c31576b`（#731），分支 `devin/1788945154-r561-fav-cloud-read` 从 main `ed021614`（#732）开。

## 1. 研究范围

R560 handoff 登记：① R560-1 更多操作层键盘模态；② R560-2 375 空态说明 clamp 裁切；③ R560-3 375 长试卷标签纵裁；④ R560-4 删除确认措辞；⑤ R560-5 `/` LCP 复采。统筹者要求 R560 观察轮之后回到**功能实现轮**，本轮主项取 R560 F1 的镜像面：H5 错题本「收藏」tab **读侧**只看本机 `favQuestions`。

## 2. 源码一手核实（verified）

### 2.1 主项：H5 收藏读侧只看本机

| 读侧 | 数据源 | 结论 |
|---|---|---|
| `pages/book/book.vue onShow` | `this.favs = uni.getStorageSync('favQuestions')` | 只读本机；`fetchFavs()` 仅在 R560 `unfavCloud` 历史条目回查时调用，不用于展示 |
| `pages/practice/practice.vue onShow` | `this.favs = uni.getStorageSync('favQuestions')`，`isFaved` 按题干判星 | 只读本机 → 别处收藏的题在题页星星不亮 |
| `pages/profile/profile.vue onShow` | `favN = favQuestions.length` | 只读本机 |
| `pages/pkgA/social/favorites.vue` | `fetchFavs()` 云端优先 + 本机按题干合并（本机独有标 `_local`） | **cloud-first**（既有参考实现） |
| 小程序 `pages/book/book.ts` 收藏 tab | `fetchFavs` 云端为唯一数据源，`deleteFav` 后重拉 | **cloud-only** |

- 后端 `social.py api_favs(uid, folder_id, module, limit=200)`：按 uid 查 `question_favs` → 用题库整题 hydrate（`id/question/options/answer/explanation/hs_explanation/xp_explanation/xp_school/module/submodule/is_real/exam_year/exam_region/image/image_credit`）+ `folder_id/faved_at/note`，按 `faved_at` 倒序，已删题不返回 → **字段足够直接构造 H5 收藏卡**，0 协议改动即可读。
- `auth.py` 账号合并已覆盖 `question_favs` 等 uid 表 → 不需要后端改动。
- 写侧现状（R560 后）：题页/模考报告收藏双写（本机 + `setFav(qid)`），云写失败 `.catch(() => {})` 静默；本机条目 R560 起带 `id`（时政/内联 `null`），历史条目无 `id`。

用户影响（inference，基于上表源码而非生产聚合数据）：同一 uid 在小程序或另一台设备收藏 → H5 错题本「收藏」tab / 我的·收藏数 / 题页星星都看不到；同一 uid 的「收藏夹与笔记」页却能看到 → 同一产品内两处口径不一致。生产 `question_favs` 非测试 8 行 / 8 uid 不能分辨客户端来源，**不作为立项数据依据**，立项依据是源码不对称 + 收藏夹页/小程序既有 cloud-first 语义。

### 2.2 R560-1..5 现状

- R560-1：`kg-sheet` 是 `wd-popup` 封装（全仓 29 处 `<kg-sheet>`），无 `role=dialog`/焦点圈定/Escape/`popstate` 处理；修法属组件通用行为（29 处受影响），本轮**不改**，登记继续。
- R560-2：`KgEmptyState` 规范 `desc` ≤2 行（`-webkit-line-clamp:2`），生产 375 实测容器 280×37.69px、`scrollHeight=57`——错题本空态 desc 55 字（≈3 行）超规范；R560 报告已定位为文案超长而非组件缺陷 → **本轮缩文案**（≤42 字），不改通用组件。
- R560-3：生产 CDP 实测（`~/r545/tagprobe*.py`，`/#/pkgA/exam/list` 375）：既有短标签 `ch=20/sh=20` 内文高 12；长试卷标签 `ch=20/sh=23`，内部 `uni-text` 高 24（`line-height:1` 12px × 2 行，top −2）→ 现象层根因：`kg-tag` 为 `inline-flex`，容器级 `.pbadge{nowrap;ellipsis}`（book.vue 既有）作用不到作为 flex item 的内部 text，text 在 `max-width:40vw` 内收缩到 min-content 折成两行，被 20px 定高纵裁（浏览器层为何忽略继承的 nowrap 未再深究，以实测为准）。三方案实测：仅 `line-height:20px` → `sh=30` 更差；内部 text `nowrap + ellipsis + min-width:0` → `sh=20` 与短标签一致。**本轮采用后者** + 容器 `max-width:100%`。
- R560-4：`del(m)` 弹窗仅标题「确定删除这道错题？」无 `content`（无不可恢复/复习队列提示），批量删除已有「不可恢复，也不再进入复习队列」→ 单条对齐（mastered 分支不提复习队列）；`confirmText` 补「删除」（默认「确定」）。`confirmColor` 仓库约定不传（App.vue 主题统一）；mastered 分支不写「历次作答不受影响」——`study_api.py`/`db.py` 未能证明删除 `mistakes` 不影响 `/api/attempts` 合并口径，不写未验证的断言。
- R560-5：本轮不改首页文件，发版后按 SKILL 复采 LH 记录，不归因。

## 3. 设计论证（主项）

- 样本/标签：本机 `favQuestions`（有 id / 无 id）× 云 `question_favs`（同 uid）→ 对账后单一列表；标签：`cloud`（有 id 且云有）/ `local-only`（无 id：时政/内联/历史/云写失败）/ `removed-elsewhere`（有 id 云无）。
- 修法（仅 H5，0 后端/协议）：
  - `exam-fav.js`：`favFromCloud(it)`（云条目 → 本机 schema，`t = faved_at*1000`）、`reconcileFavs(local, cloud, now)`（题库题以云为准：有 id 按 id、无 id 按题干精确匹配认领 id；匹配到的保留本机字段与 `t`；云独有补进；有 id 云无且 `t` 超 `FAV_GRACE_MS=60s` 视为别处已取消删掉，60s 内保留以容忍 POST 尚未落库；无 id 条目一律保留；倒序、200 上限）、`markFavLocalOnly(favs, question)`、`favsLocalOnly(favs)`。
  - `fav-sync.js syncCloudFavs()`：`fetchFavs()` → `reconcileFavs` → 落盘并返回列表；module 级 in-flight promise 去重；失败 `null` 不动本机。
  - `book.vue`：`onShow` 先渲染本机（0 网络等待）再 `syncFavs()`；等待期间用户本机取消（`_favSeq` 变）→ 丢弃云结果、以本机为准落盘（云 DELETE 已由 R560 `unfavCloud` 发出，下次 onShow 对齐）；展开态按题干保留；卡 key `q<id>|t<t>`。
  - `practice.vue`：`onShow` 同步（别处收藏的题星星会亮）；收藏时 `setFav` 失败 → `markFavLocalOnly` 降级（否则下次对账被当「别处已取消」删掉）；取消计 `_favSeq`。
  - `report.vue`：同上降级；`removeFav` 失败不回滚（R560 口径）。
  - `profile.vue`：先显本机数再云对账更新；恢复码恢复后 `favsLocalOnly`（恢复的是别人的/旧 uid 的本机条目，其 id 与当前 uid 云端无关，若不清空会在首次对账时被整体删除）。
- 与现状对比：修前 H5 错题本收藏 = 本机集合；修后 = 云集合 ∪ 本机无 id 集合，与「收藏夹与笔记」页、小程序口径一致；取消收藏路径不变（R560）。
- 风险（inference）：R560（9c31576b）起到本轮上线之间，若题页收藏 `POST /api/favs` 静默失败，本机会留下「有 id 但云无」的条目，首次对账会将其删除（视为别处取消）。窗口约 1 天、生产非测试收藏 1 天内 0 新增行，影响面可忽略，如实登记。
- 验收（生产黑盒）：A 云独有可见（fixture `POST /api/favs` 造 1 行 → 新冷 context 打开错题本收藏 tab → 期望 `GET /api/favs` 200、卡片显示、我的·收藏数 1、题页该题星星亮）；B 别处取消消失（第二 context DELETE → 第一 context 切走再回 → 消失）；C 时政/无 id 本机条目对账后保留；D 取消收藏与同步竞态（取消后云列表不复活）；E 云失败降级（阻断 GET → 本机不变）；F 375/1440 空态与长标签几何、删除弹窗文案；G R560 A/B 回归。

## 4. 实修落地

- 文件：`exam-fav.js`（+4 函数）/ 新 `fav-sync.js` / `book.vue` / `practice.vue` / `profile.vue` / `pkgA/exam/report.vue` / `components/kg-tag/kg-tag.vue`；测试 `tests/r561-fav-cloud-read.test.js`（23：纯函数 13 + sync 2 + 源锁 8）、`r544-ux-gaps.test.js` 空态标题源锁改「还没有收藏」。
- 文案：收藏空态「还没有收藏 / 刷题时点顶栏星星收藏好题；小程序、其他设备的收藏也会同步到这里」（33 字）；错题空态 desc 55→41 字。
- 本地门：H5 vitest 177 文件 **1322**（+23）/ eslint 0 / lint-pages 20 warn（与 main 基线一致）/ tokens check / build:h5（`index-CmQPo610.js`，`kg-tag__t` scoped 规则已入产物）/ `diff --check` 空；后端、小程序 0 改动未跑。

## 5. 发版与生产复验

（发版后回填）
