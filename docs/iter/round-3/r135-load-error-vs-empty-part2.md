# R135：分包页加载失败误呈现为空态收口（二期）

## 取证（2026-08-31，生产一手）

方法同 R134：生产壳预热后 `page.route('**/api/**', abort)` 逐页直入（1440），排查 R134 未覆盖的其余分包/主包路由。

结果（verified，失败均被渲染为「无数据」空态且无驻留错误/重试）：

| 页面 | 失败时呈现 | 备注 |
|---|---|---|
| /pkgA/interview/history | 「还没有练习记录」 | catch 只 toast |
| /pkgA/pk/pk | 「本周还没有对局」+「还没有对局记录」 | loadHome catch 完全静默（无 toast） |
| /pkgA/social/inbox | 登录态失败会落「暂无消息」 | 游客走登录引导分支，不受影响 |
| /pkgA/team/team | 「还没有小队…」 | loadHome catch 完全静默 |
| /pkgA/shenlun/shenlun | 「暂无题目/暂无素材/还没有作答记录」 | 三 tab 各自 catch 只 toast |
| /pkgA/social/discuss | 「还没有讨论」 | catch 只 toast |

主包 /pages/stats/stats 与 /pages/book/book 同样存在（「暂无数据」「错题本还是空的」），但两页有本机快照兜底（R90/R108）且卡片多、状态复杂，留待 R136 单独取证立项，不混入本轮。

## 方案

沿用 R134 契约：data 增 `loadErr`（shenlun 三 tab 分别 `qErr/mErr/rErr`），load 开头清空、catch 置 `e.message`（原 toast 保留；pk/team 原完全静默的 loadHome 补驻留错误但不加 toast，维持「非关键路径不打扰」原则的同时给出可见出路）；模板在空态分支前插 `v-else-if` 错误卡「加载失败：{{msg}} + 重试 ›」，重试重跑对应 load。inbox 错误卡置于登录引导分支之后（游客不发请求，行为不变）。零后端/零边缘改动，成功路径与真实空数据呈现不变。

## 验收

- 本地 lint/vitest/build:h5 全绿。
- 生产部署后复跑探针：6 页失败态均出现「加载失败+重试」且不再渲染空态文案；放行 API 后点重试原位恢复。
- 1440/375 双视口、无横向溢出；console 仅探针 abort 预期噪声。
