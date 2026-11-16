# R328 设计方案：AI 问答历史会话跨设备同步（askSessions 服务端化）

日期：2026-08-29 ｜ 轮次：round-3 R328 ｜ 状态：实施

## 取证（一手证据）

- ask.vue 已有完整本机会话历史：archiveCurrent 归档到 `askSessions` storage（上限 20 条，
  含 title/n/items，items 内含题目、AI 讲解全文、追问 fu），loadSession 恢复、delSession 删除
  （ask.vue L740–804 实查）。
- `askSessions` 纯本机：grep 后端零命中，换设备/清缓存后 AI 讲解历史全丢——AI 讲解是站内
  最高成本产出（真实 LLM 调用），却是全站唯一仍纯本机的核心资产（收藏/错题/草稿/进度均已
  服务端化：R296/R297/R298/R322）。
- 竞品：粉笔 AI 老师讲题历史、夸克 AI 讲解记录均为账号级跨设备可回看。

用户可感知痛点：花过钱（配额）问出来的 AI 讲解，换台设备就没了，只能重新提问重新消耗。

## 方案（新表 + 双端点，沿用 R322 服务端化口径）

后端：
1. 表 `ask_sessions(uid TEXT, sid INTEGER, ts INTEGER, title TEXT, n INTEGER, items TEXT,
   updated_at REAL, PRIMARY KEY(uid,sid))`，幂等建表。
2. `POST /api/ask/sessions`：body {uid, sid, ts, title, n, items}；校验：uid 必填 ≤64；
   sid/ts 正整数（拒 bool）；title 字符串截 60；n 1..50；items 必须 list 且每项 dict，
   序列化后 ≤200KB，否则 400 fail-closed；rl 限速（uid 桶）。upsert 后按 ts 降序只保留
   每 uid 最新 20 条（服务端裁剪，与本机口径一致）。
3. `DELETE /api/ask/sessions/{sid}?uid=`：删除单条（loadSession/delSession 同步）。
4. `GET /api/ask/sessions?uid=`：ts 降序 ≤20 条 {items:[{id:sid, ts, title, n, items}]}。

前端（ask.vue）：
1. 新纯函数 `src/ask-sessions.js`：`mergeAskSessions(local, remote)`——按 id 去重并集
   （本机优先），ts 降序，cap 20；非法输入 fail-closed 返回合法数组。
2. onShow 异步 GET 合并（失败静默，本机数据不受影响），合并结果回写本机 storage。
3. archiveCurrent 归档成功后异步 POST 该条（失败静默，本机仍在，下次归档不补推旧条——
   简单口径，跨设备至少覆盖此后所有新会话）。
4. loadSession / delSession 异步 DELETE 对应 sid（失败静默）。

不做：不改 /api/explain 契约；不做增量 diff/冲突合并（id 唯一、内容不可变，无冲突面）；
不同步 askCurSession 进行中会话（属过程态，归档时才成资产）。

## 验收

- 生产：设备 A 归档会话 → 设备 B（全新隔离 context 同 uid）打开历史面板可见并可恢复展示
  讲解全文与追问；删除后双端消失；非法 payload 逐项 400；旧客户端（不带同步）行为不变。
- 1440/375 双视口、console 0 error、无溢出；不触发真实 LLM（用既有会话或手工构造归档）。
- 测试 uid 验后全库清理 LEFTOVER 0，保护 uid 快照一致。

## 测试

- pytest：roundtrip / 上限 20 裁剪 / 删除 / 非法（缺 uid、sid bool、items 非 list、超 200KB）400。
- vitest：mergeAskSessions 去重并集 / ts 排序 / cap 20 / 非法输入 fail-closed。

## 反伪造边界

只同步用户真实归档的会话；不声称任何增长/留存效果。
