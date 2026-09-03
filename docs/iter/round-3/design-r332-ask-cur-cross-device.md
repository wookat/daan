# R332：AI 问答进行中会话跨设备同步

## 取证（生产 rev 076df65 + 源码）
- R331 已让进行中会话（askCurSession）刷新可恢复，但快照仅存本机 storage：换设备/清缓存后进行中会话仍然全丢（R331 如实挂出的边界）。
- 已归档会话 R328 已服务端化（ask_sessions 表 + /api/ask/sessions），但进行中会话是「成本最新鲜」的状态——用户刚消耗真实 LLM 成本讲解/追问，未点「新对话」前换设备打开 ask 页面是空态。
- 同构先例：R298 exam_progress、R322 practice_progress 均为「uid 单快照 + POST 保存/清除 + GET resume + 本机快照优先」，模式成熟。
- 对标：粉笔 AI 讲题/夸克 AI 讲解会话为账号级持续态，跨端进入上下文仍在。

## 方案（复用单快照模式，最小契约）
1. 后端 db.py 新增 ask_cur 表（uid PRIMARY KEY, sid, ts, items JSON, updated_at）+ save/clear/get 三函数（与 practice_progress 同构）。
2. ai_api.py 新增：
   - `POST /api/ask/cur`：{uid, sid, ts, items}。items 非 list / >50 条 / 含非 dict 条目 / 序列化 >200k → 400；`items: []` = 清除快照；sid 允许 0（未归档过的新会话）或正整数（loadSession 恢复的历史会话，衔接 R329 同 sid 语义）；ts 正整数。rl uid 桶 120/h。
   - `GET /api/ask/cur?uid=`：无快照或 updated_at 超 7 天 → `{}`；否则 {sid, ts, items}。
3. 前端 ask-sessions.js 新增纯函数 `parseRemoteCur(data)`：fail-closed——非对象返回 null；items 经 sanitizeCurItems 后为空返回 null；sid 仅接受正整数否则归 0；返回 {sid, items}。
4. ask.vue：
   - persistSession() 末尾追加去抖 1.5s 的 pushCurSession()（POST 整份 askCurSession，失败静默）；
   - newSession() 清本机后立即 POST `items: []` 清服务端并取消未决去抖，防止陈旧去抖复活；
   - restoreCurSession()：本机快照优先（R331 行为零变化）；本机无快照时异步 GET /api/ask/cur，回调中守卫（results 非空 / 本页已点过新对话则丢弃），parseRemoteCur 通过才 adoptItems 回填，sid>0 时恢复 curSid/askCurSid，随后 persistSession() 落本机。

## 不做
- 不改 /api/explain 契约、不触发真实 LLM；
- 不做进行中会话多设备并发合并（单快照 last-write-wins，与 exam/practice 同口径）；
- 已归档会话同步（R328–R330 语义）零变化。

## 验收
- 后端 ruff/pytest（新增 test_ask_cur.py）/pyright；前端 lint/vitest（parseRemoteCur）/build；
- 生产：设备 A 产生进行中态 → 设备 B（全新隔离 context 同 uid）打开 ask 页自动回填；A「新对话」清除后 B 刷新为空态；本机快照优先（有本机时 0 次 GET cur 回填覆盖）；R328–R331 回归；双视口溢出 0、console 0 error、零 /api/explain；测试 uid 清理 + 保护 uid 快照一致。
