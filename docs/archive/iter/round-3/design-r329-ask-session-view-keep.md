# R329 设计方案：AI 问答历史会话「查看不销毁」+ 再归档回写同一会话

日期：2026-08-29 ｜ 轮次：round-3 R329 ｜ 状态：实施

## 取证（一手证据）

- ask.vue `loadSession(i)`（L792–798 实查）当前语义：点开历史会话即 `splice` 出本机列表 +
  `dropRemoteSession(s.id)` 删服务端——「查看」被实现成「取出销毁」。R328 handoff 已把该语义列为注意点。
- 后果（用户可感知）：点开一条历史只是想回看讲解，若不重新「新对话」归档，这条会话本机与服务端都永久消失；
  若重新归档则生成新 `Date.now()` sid，同一会话在 20 条 cap 里产生重复占位且 ts 被重置。
- 竞品：粉笔 AI 老师/夸克 AI 讲解的历史会话均为「点开查看、可继续追问、列表保留」，删除只走显式删除。
- R328 服务端 POST /api/ask/sessions 已按 (uid,sid) upsert——服务端能力已就位，纯前端收口。

## 方案（纯前端零后端/零契约）

1. `src/ask-sessions.js` 新增纯函数 `upsertLocalSession(sessions, sess)`：
   按 id 去重（移除旧条目）后 unshift 新条目、cap 20；非法输入 fail-closed（sessions 非数组按 []、
   sess 非法原样返回数组副本）；输入不可变。
2. ask.vue：
   - data 补 `curSid: 0`（当前 results 对应的历史会话 sid；0=全新会话）；
   - `loadSession(i)`：不再 splice/不再 dropRemoteSession；`archiveCurrent()` 归档进行中会话后
     `curSid = s.id` 并写 `uni.setStorageSync('askCurSid', s.id)`（防刷新丢 sid 产生重复归档）；
   - `archiveCurrent()`：`sid = this.curSid || getStorageSync('askCurSid') || Date.now()`；
     本机列表改用 `upsertLocalSession`（同 sid 去重置顶）；POST 带该 sid（服务端 upsert 同条）；
     归档后 `curSid = 0` 并 removeStorageSync('askCurSid')；
   - `newSession()` 同步清 curSid/askCurSid；
   - `delSession(i)` 显式删除语义不变（本机 splice + 远端 DELETE）。
3. 恢复后继续追问/新增提问：items 增长，再归档回写同一 sid，ts 更新为 now（置顶，与服务端
   ORDER BY ts DESC 一致）。

不做：不改后端；不改 mergeAskSessions；不做「进行中会话」实时同步。

## 验收

- 生产 1440/375：点开历史→列表条目保留（本机+服务端 GET 仍返回）；恢复后追问再「新对话」→
  列表同 sid 置顶更新（n 增长）不出现重复条目；显式删除仍即时移除且远端 DELETE；
  跨 context 同 uid 可看到更新后的会话；无溢出、console 0 error、零 /api/explain。

## 测试

- vitest：upsertLocalSession 去重置顶 / cap20 / 非法输入 fail-closed / 输入不可变。

## 反伪造边界

不伪造 AI 讲解；验证用注入造数会话；不声称真实 LLM 验证。
