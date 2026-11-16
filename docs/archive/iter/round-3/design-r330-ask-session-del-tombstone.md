# R330 设计方案：AI 问答历史会话删除墓碑 + 失败重试——收口「删除复活」

日期：2026-08-29 ｜ 轮次：round-3 R330 ｜ 状态：实施

## 取证（生产实证，R329 testing agent 实景发现）

- ask.vue `delSession(i)`：本机 splice 后 `dropRemoteSession(sid)` 失败静默（`.catch(() => {})`）。
- 生产同机负载 503 窗口实测：显式删除首次 DELETE 503 → 本机已移除但服务端残留；
  用户刷新/再进页 `syncSessions()` union merge 把该条从远端重新并回本机——**删除的会话「复活」**。
- 现有语义下用户必须再删一次；弱网/过载窗口（本阶段已 4 次实景出现）该体验缺陷真实可感知。
- 竞品口径：粉笔/夸克删除历史即终态，不会因网络抖动复活。

## 方案（纯前端零后端/零契约）

1. `src/ask-sessions.js` 新增纯函数（fail-closed、输入不可变）：
   - `addTombstone(tombs, sid, now)`：`{sid: deletedAtMs}` map；非法 sid 原样返回；cap 40（防膨胀）。
   - `pruneTombstones(tombs, now)`：TTL 7 天过期清除；非 object 按 {} 处理。
   - `filterTombstoned(sessions, tombs)`：merge 前过滤远端已删 sid。
2. `ask.vue`：
   - `delSession`：本机移除 + `addTombstone` 写 storage `askDelTombs`，再发 DELETE；成功回调移除该墓碑。
   - `syncSessions`：先 prune 墓碑；远端 items 经 `filterTombstoned` 再 merge（同设备不再复活）；
     随后对每个墓碑 sid 异步补发 DELETE（重试通道），成功移除墓碑，失败静默留待下次。
   - `archiveCurrent` 同 sid 再归档时移除该 sid 墓碑（用户显式重建视为撤销删除）。

## 边界（如实）

- 墓碑仅本机：跨设备场景（B 删、A 弱网时同步）A 无墓碑仍可能短暂看到，属服务端无墓碑固有限制，不做服务端改动（本轮宗旨零契约）；主缺口是「同设备删除复活」+「删除最终必达」，二者本方案闭环。
- 不改 /api/explain、不触发真实 LLM。

## 验收

- vitest：addTombstone/prune TTL/cap/filter/非法输入 fail-closed/输入不可变；既有 merge/upsert 测试通过。
- 本地门禁：lint/vitest/build（纯前端）。
- 生产：testing agent 模拟 DELETE 失败（如网络拦截/过载窗口不可控则用 CDP request interception 阻断 DELETE），
  验证删除后刷新不复活、恢复网络后自动补发 DELETE、服务端最终为空；显式重建同 sid 撤销墓碑。
