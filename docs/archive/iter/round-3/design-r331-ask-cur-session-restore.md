# R331：AI 问答进行中会话刷新恢复

## 取证（生产 rev e5c4ae3 + 源码）
- ask.vue 每次讲解/追问后 persistSession() 把当前会话逐条写入本机 storage `askCurSession`，但**全页无任何读取回填 results 的路径**：data() 只读 recentExplains，onShow 只做 loadDue/syncSessions/redoQuestion。
- 后果：进行中会话（未点「新对话」归档）刷新/关闭标签页后 UI 消失；此时 results=[]，archiveCurrent 首行 `if (!this.results.length) return` 直接短路，快照永远无法进入历史；用户随后点「新对话」还会 removeStorageSync('askCurSession') 把快照物理删除——已消耗真实 LLM 成本的问答**永久丢失**。
- 对标：粉笔 AI 讲题/夸克 AI 讲解会话均为持续态，刷新回来上下文仍在。

## 方案（纯前端，零后端/零契约）
1. ask-sessions.js 新增纯函数 `sanitizeCurItems(items)`：非数组/非法输入 fail-closed 返回 []；仅保留 object 且 `explanation` 为非空 string 的条目（回填渲染依赖 explanation）；输出新数组不可变。
2. ask.vue 抽出 `adoptItems(items)`（loadSession 内既有映射逻辑复用：html/ansCard/sim 等瞬态字段重建 + applyExplain + fu md 渲染）。
3. onShow 首次进入时（`results` 为空且未恢复过）读 `askCurSession` 经 sanitizeCurItems 后 adoptItems 回填 results（注意存储序即 results 序，无需 reverse）；curSid 已由 data() 读 askCurSid 恢复，同 sid 归档语义（R329）自然衔接。
4. 不改 persistSession/archiveCurrent/newSession 语义；「新对话」仍是显式清空口径。

## 边界
- 快照仅本机（进行中会话本就未服务端化，R328 只同步已归档会话）；跨设备进行中恢复不在本轮。
- 恢复后 ansCard/sim 等瞬态不还原（与 loadSession 恢复历史一致口径）。
