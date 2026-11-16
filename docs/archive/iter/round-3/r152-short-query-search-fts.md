# R152：短关键词（1–2 字）搜索走单字分词 FTS，消灭冷缓存 LIKE 全表扫描

## 生产取证（2026-08-29，全部一手实测）

- 公开站 `/api/search?q=隧道`（2 字）首跳 **15.1s / 19.8s**，重复请求 0.39s；
  `q=增长率`（3 字）走 FTS 仅 0.86s。
- 容器内实测：`fts_sync.last_id == MAX(questions.id)`，trigram FTS 已全量回填
  （156,792 行），3 字 MATCH 0.02s——FTS 本身健康。
- 根因：`_search_questions` 对 `len(q) < 3` 的查询固定走
  `LIKE '%q%'` 全表扫描（trigram 分词 MATCH 仅支持 ≥3 字）。
  data.db 370MB / 2G 共享宿主，页缓存被逐出后该扫描全靠磁盘 I/O：
  `echo 3 > drop_caches` 后容器内实测 `SELECT id … LIKE` **97.7s**、
  `SELECT * … LIKE + ORDER BY` **270.3s**。
- 中文搜索词大量为双字词（隧道/类比/主旨/成语/增长…），此路径是真实
  golden path，不是长尾。
- 备选方案实测排除：fts5vocab 词表 245 万 term，`term LIKE '%隧道%'`
  冷扫描 36.3s——bigram 展开不可行。

## 方案

SQLite CJK 子串搜索的成熟做法：**单字空格分词 + unicode61 + phrase 查询**。

1. `_fts_ready` 增建 `question_fts_cjk`：`fts5(question, content='')`
   contentless 表，入库文本为逐字空格分隔（`_cjk_pad`），rowid=题目 id。
2. `fts_backfill` 扩展第二个同步键 `questions_cjk`，由既有后台回填线程
   分批建索引（首次 15.6 万题不阻塞启动；题干文本生产中从不 UPDATE，
   disabled/删除由 JOIN questions 过滤，contentless 无需触发器）。
3. `_search_questions`：`len(q) < 3` 且 cjk 索引已追平 MAX(id) 时，
   phrase MATCH `"隧 道"` 走索引；未追平期间保持原 LIKE 兜底，行为不变。
   ≥3 字保持 trigram 路径不动。

已知边界（如实声明）：unicode61 丢弃标点 token，phrase 会把「隧，道」
也命中为「隧道」——子串语义轻微放宽，属可接受超集；trigram 路径不受影响。

## 验收

- pytest 新增回归：2 字查询在 cjk 索引就绪后返回命中且不走全表 LIKE。
- 生产部署后：回填完成 → 清页缓存冷测 `/api/search?q=隧道` 亚秒级。
