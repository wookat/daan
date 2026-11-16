# R404：本地全量 pytest 间歇 `database is locked` 根因——DEFERRED 事务内先读后写遇他线程提交即刻 SQLITE_BUSY（快照不可升级、busy_timeout 不介入）→ 连接改 `isolation_level="IMMEDIATE"`

日期 2026-09-06（UTC）。分支续 R400–R403（base=main）。生产 rev 上线前 `412deb6`。

## 1. 起点

R403 汇报如实记录：R396–R402 分支上全量 pytest 多数次数出现 5 例 `database is locked`（`origin/main` 干净），线索指向 R372 `_ConnProxy` 线程本地常驻连接。R404 先取证、再决定改不改生产连接。

## 2. 取证过程（一手）

### 2.1 排除的假设

- 「任何未耗尽游标都会稳定导致锁」**不成立**：隔离实验里 `fetchall`、单行 `fetchone`、`LIMIT 1 fetchone`、无引用 `fetchone`（游标随即 GC）全部可写；只有「读遍历中写 + 另一连接同时提交」失败。
- 「普通写锁竞争」**不是失败形态**：另一连接持未提交写锁 1 s 后释放，本连接 deferred / immediate / 有无 FTS 触发器三种情况都是 **等 1.03 s 后成功**（busy handler 正常工作）。

### 2.2 失败现场 SQL trace（`~/r404_snapshot_plugin.py`，`set_trace_callback`；`~/r404_trace.log`）

主线程（测试）失败瞬间的语句序列：

```
BEGIN
PRAGMA 'main'.data_version
PRAGMA 'main'.data_version
SELECT k, v FROM 'main'.'question_fts_config'          ← FTS5 在 INSERT 语句内部重载 config（只读，开读快照）
INSERT OR IGNORE INTO questions (...)                   ← 触发器 question_fts_ai 需写 FTS，升级写锁
→ OperationalError: database is locked（耗时 0 ms）
```

同一时刻 `Thread-3 (_fts_backfiller)` 正在同一库上做 `REPLACE INTO question_fts_docsize / INSERT INTO question_fts(...)`（`fts_backfill` 每批 5000 行一个事务、批间 `sleep(2)`）。而同一测试稍后（`.814`）的同款 INSERT 只有 `-- PRAGMA data_version`（未重载 config）就直接成功。

注：插件在 `pytest_collection_finish` 才替换 `get_conn`，打印 `patched get_conn in 0 modules`，app 模块引用未被替换；trace 来自 fixture 建库阶段已装回调的连接对象（线程本地常驻，主线程/后台线程各一），覆盖了失败现场，但不是全量应用 SQL。

### 2.3 最小复现（Python 3.12.13 / SQLite 3.37.2，脚本已收进单测）

| 序列 | 结果 |
|---|---|
| `BEGIN`（deferred）→ `SELECT` → 另一连接持写锁并在 0.2–0.5 s 后 **提交** → `INSERT` | **`database is locked`，0.00 s**，`sqlite_errorcode=5 SQLITE_BUSY`（Python 不暴露扩展码） |
| `BEGIN IMMEDIATE` → 同上 | 等待写锁释放后成功 |
| deferred，另一连接持锁但**不提交**、1 s 后释放 | 等 1.03 s 成功 |

机制（SQLite WAL 文档「SQLITE_BUSY_SNAPSHOT」）：deferred 事务里第一条 SELECT 开只读快照；随后写入要升级写锁，若期间有他连接已提交、快照已过期，则升级失败**立即**返回 BUSY（busy handler 不介入，`busy_timeout=30000` 无效）。Python `sqlite3` 默认 `isolation_level=""` 在 DML 前隐式发 `BEGIN`（deferred）；INSERT 语句内部 FTS5 触发器重载 config 的那次读，正好落在 BEGIN 与真正写入之间。

### 2.4 A/B（同一机器、同一命令 `python -m pytest -q`，plugin 记录锁失败）

| 版本 | 轮数 | 出现 `database is locked` 的轮数 |
|---|---|---|
| 修前（`5ec1007`） | 6 | **2**（每轮 5 例，同 R403 记录的 5 个文件） |
| 修后（本轮） | 14 | **0**（每轮唯一失败为既有 UTC 00–02 时段时区用例 `test_answer_log_uses_client_ts_and_falls_back`） |

## 3. 改动（`backend/app/db.py`，1 行）

```python
conn = sqlite3.connect(DB_PATH, timeout=30, isolation_level="IMMEDIATE")
```

Python 隐式事务改为 `BEGIN IMMEDIATE`：DML 前先拿写锁（busy handler 排队等待），语句内部的先读（FTS5 config 重载、触发器子查询）都发生在写事务里，不再存在「读快照→升级」这一步。只读 SELECT 不受影响（Python 不为 SELECT 开事务）。`mock_event._freeze_ranks` 已显式 `BEGIN IMMEDIATE`，行为不变。

新增单测 `tests/test_conn_begin_immediate.py`：① `get_conn()` 连接的隐式事务起头必须是 `BEGIN IMMEDIATE`（去掉改动即失败）；② scratch 库上 deferred 先读后写 + 并发提交 → `SQLITE_BUSY`，IMMEDIATE 同序列成功（5/5 稳定）。

## 4. 生产影响评估（只读取证，`~/r404_vps*.sh`，输出 `~/r404_vps.txt`）

- 生产容器 SQLite **3.46.1**（本地 3.37.2），触发器 `question_fts_ai/ad/au` 同在，FTS backlog 0。
- 当前容器日志 `database is locked` **0**、Traceback 0；中心 zalize-monitor 近 124 条 kaogong 错误里 locked/OperationalError 命中 1 条，展开是历史 `duplicate column name: probe`（R374 收口已修），**非锁**。
- 触发条件在生产的对应物：**写 `questions` 表**（有 FTS 触发器）时恰有他连接提交且 FTS5 需重载 config。真人写路径（mistakes / answer_log / users / review）**不带 FTS 触发器**，deferred 事务里也没有先读再写，普通写锁竞争走 busy handler 等待——因此这不是 R372 上线以来真人「database is locked」的来源，生产日志 0 条与此一致。
- 有风险的生产场景是：管理台导入/编辑题干、启动期种子导入、`_fts_backfiller` 与 `refresh_question_stats`（`UPDATE questions` 每批 100 行提交）同时活跃时；治理脚本在容器外用独立连接写库，也会让容器内连接下一次 questions 写入重载 config。本轮改动把这些场景从「即刻报错」变为「排队等待」，属加固，不是事故修复。

## 5. 不做 / 如实说明

- 不改 `_ConnProxy` 常驻连接、不改后台线程启动方式、不改测试夹具去掩盖（锁是真实机制，测试只是先撞上）。
- 未验证：生产 3.46.1 上的复现（不为验证制造生产写入）；本地 3.37.2 复现的机制在 SQLite 文档中自 3.8.x 起未变。
- Python 3.12 `sqlite3` 仍是 legacy transaction control（`autocommit` 属性未启用），`isolation_level` 语义确定；升级 Python 若切到 `autocommit=False` 模式需重新核这条。
