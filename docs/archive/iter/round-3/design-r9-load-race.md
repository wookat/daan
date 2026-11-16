# R9 设计方案：错题本 load() 并发竞争防护（修复掌握切换偶发不生效）

日期：2026-08-30 ｜ 轮次：round-3 R9 ｜ 前置：R8 独立走查瑕疵（PR #181 评论）

## 1. 取证

- R8 生产走查复现：已掌握项 ··· sheet 点「恢复复习」首次偶发不生效（sheet 关闭、API 仍 mastered=1），二次点击成功；API 读可见有 ~20s 延迟窗口。
- 排除 CDN：`/api/mistakes` 生产响应 `cf-cache-status: DYNAMIC`，无边缘缓存；后端 db.py 对 mistakes 读无进程内缓存。
- 代码审计定位竞争窗口：`book.vue` 的 `load()` 无并发防护。tab 切换 / onShow / master() 均会触发 `load()`；当一个较早发起的 `load()`（其 GET 发生在 PATCH 之前）晚于乐观更新返回时，会用**旧快照整体覆盖 `this.items`**，表现即「点了没生效」，直到下一次刷新才恢复——与走查现象（二次点击成功、延迟后可见）一致。

## 2. 方案

`load()` 引入自增序号 `_loadSeq`：发起时取号，响应返回后（成功与失败分支均）与最新序号比对，非最新一律丢弃，保证只有最后一次发起的 `load()` 能写入 `items/due` 状态。零接口改动、零 UI 改动。

## 3. 验收标准

- 本地 build:h5 通过（仓库无 lint/test 脚本）。
- 生产：快速连续「标为已掌握→sheet 恢复复习」多次往返，每次均无需 F5 即时生效、无旧快照回跳；API mastered/mastered_at 与 UI 一致；1440/375 无回归、console 0 error。
