# R140：讨论/笔记 UGC 输入草稿保护

## 取证（verified，源码逐处核查 2026-08-29）

R138 收口了面试作答（5000 字）草稿丢失，本轮延续同一探针对全站剩余长文本输入入口逐处核查：

| 入口 | 文件 | 上限 | 现状 |
| --- | --- | --- | --- |
| 题目讨论发言/回复 | `pkgA/social/discuss.vue`（`draft`） | 500 字 | 纯内存 `v-model`，刷新/标签页回收即丢 |
| 题目笔记编辑 | `components/q-social-bar/q-social-bar.vue`（`draft`） | 1000 字 | 纯内存；「取消」误触即整篇丢弃，无恢复 |
| 申论作答 | `pkgA/shenlun/shenlun.vue` | — | 已有 `slDraft:<id>` 逐题草稿（存量能力） |
| 面试作答 | `pkgA/interview/interview.vue` | — | R138 `ivDraft` 快照（已收口） |
| 题目纠错补充说明 | `pages/book/book.vue`（`reportDetail`） | 500 字 | 弹层内选填短文本，丢失代价低，本轮不立项 |

丢失场景（与 R138 相同）：H5 移动端切后台标签页回收、误触刷新/返回、笔记「取消」误触。
讨论页另有登录跳转链路：未登录输入后点「发布」→ 弹窗去登录（`navigateTo`），返回时页面栈保留草稿尚存，但登录页内刷新即全丢。

## 方案（零后端，沿用既有 slDraft 键模式）

- 讨论页：`dcDraft:<qid>` 逐题草稿。`onLoad` 命中即恢复；`watch draft` 即存（空即删）；发布成功后清除。
- 笔记编辑：`qNoteDraft:<qid>` 逐题草稿。`startEdit` 优先恢复草稿（无草稿回落已保存笔记原文）；编辑中 `watch draft` 即存；保存成功清除；「取消」保留草稿（下次进入编辑可恢复，消灭误触丢稿）。
- 草稿与已保存笔记一致时不冗余存储（存前比对，相同即删键）。

不做：纠错弹层草稿（选填短文本）；跨设备同步（本机 storage 语义与 slDraft/ivDraft 一致）。

## 验证

- 本地：`npm run lint` / `npm run test` / `npm run build:h5` 全绿。
- 生产 1440/375：讨论页输入→刷新→草稿恢复→发布成功→再刷新不再恢复；笔记输入→取消→再编辑恢复→保存成功→草稿清除。测试数据清理、保护 uid 零 mutation。
