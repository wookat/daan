"""错题本存储（SQLite）。"""

import hashlib
import json
import math
import os
import re
import sqlite3
import threading
import time

from . import similarity

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "..", "..", "data.db"))

_local = threading.local()

class _ConnProxy:
    """线程内复用底层连接：close() 仅回滚未提交事务（与真实 close 语义一致），
    连接与其堆内页缓存常驻，避免同机邻居 I/O 挤出 OS 页缓存后每请求重读索引。"""

    __slots__ = ("_conn",)

    def __init__(self, conn):
        self._conn = conn

    def close(self):
        try:
            self._conn.rollback()
        except Exception:
            pass

    def _failed(self, e: BaseException):
        """语句失败即回滚（残留写事务会锁全站写路径）；参数绑定失败归为参数错误，由 /api 统一映射 400。"""
        try:
            if self._conn.in_transaction:
                self._conn.rollback()
        except Exception:
            pass
        if isinstance(e, (sqlite3.InterfaceError, sqlite3.ProgrammingError)) and "binding parameter" in str(e):
            raise ValueError("参数格式错误") from e

    def execute(self, *args, **kwargs):
        try:
            return self._conn.execute(*args, **kwargs)
        except Exception as e:
            self._failed(e)
            raise

    def executemany(self, *args, **kwargs):
        try:
            return self._conn.executemany(*args, **kwargs)
        except Exception as e:
            self._failed(e)
            raise

    def __getattr__(self, name):
        return getattr(self._conn, name)

SQLITE_CACHE_KIB = -8192

SQLITE_MMAP_BYTES = 1 << 30

SQLITE_WAL_LIMIT_BYTES = 64 << 20

QUESTION_STATS_BATCH = 100

def get_conn():
    conn = getattr(_local, "conn", None)
    if conn is None:
        # 写事务以 BEGIN IMMEDIATE 起头：先拿写锁再执行语句。DEFERRED 下语句内部的先读
        # （FTS5 触发器重载 config 等）会先开只读快照，随后升级写锁若遇他线程提交则
        # 立刻 SQLITE_BUSY_SNAPSHOT，busy_timeout 不生效。
        conn = sqlite3.connect(DB_PATH, timeout=30, isolation_level="IMMEDIATE")
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=30000")
        conn.execute(f"PRAGMA cache_size={SQLITE_CACHE_KIB}")
        conn.execute(f"PRAGMA mmap_size={SQLITE_MMAP_BYTES}")
        conn.execute(f"PRAGMA journal_size_limit={SQLITE_WAL_LIMIT_BYTES}")
        _local.conn = conn
    elif conn.in_transaction:
        # 上一请求在语句之间抛出（Python 层异常）未走到 close()，事务残留会持写锁；复用前兜底回滚
        conn.rollback()
    return _ConnProxy(conn)

def init_db():
    conn = get_conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS mistakes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at REAL NOT NULL,
            module TEXT,
            question_type TEXT,
            question_text TEXT,
            user_answer TEXT,
            correct_answer TEXT,
            methods TEXT,
            error_reason TEXT,
            explanation TEXT
        )"""
    )
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(mistakes)")}
    for col, ddl in [
        ("review_count", "ALTER TABLE mistakes ADD COLUMN review_count INTEGER DEFAULT 0"),
        ("review_streak", "ALTER TABLE mistakes ADD COLUMN review_streak INTEGER DEFAULT 0"),
        ("next_review", "ALTER TABLE mistakes ADD COLUMN next_review REAL"),
        ("mastered", "ALTER TABLE mistakes ADD COLUMN mastered INTEGER DEFAULT 0"),
        ("mastered_at", "ALTER TABLE mistakes ADD COLUMN mastered_at REAL"),
        ("times", "ALTER TABLE mistakes ADD COLUMN times INTEGER DEFAULT 1"),
        ("source", "ALTER TABLE mistakes ADD COLUMN source TEXT"),
        # B1：AI 复盘结构化字段（review_fields.parse_explain 产出）
        ("mistake_analysis", "ALTER TABLE mistakes ADD COLUMN mistake_analysis TEXT"),
        ("fastest_solution", "ALTER TABLE mistakes ADD COLUMN fastest_solution TEXT"),
        ("trap_analysis", "ALTER TABLE mistakes ADD COLUMN trap_analysis TEXT"),
        ("review_tip", "ALTER TABLE mistakes ADD COLUMN review_tip TEXT"),
        # B2：掌握状态机（new/reviewing/mastered/sticky_wrong）+ 累计再错计数
        ("mastery_state", "ALTER TABLE mistakes ADD COLUMN mastery_state TEXT"),
        ("wrong_review_count", "ALTER TABLE mistakes ADD COLUMN wrong_review_count INTEGER"),
    ]:
        if col not in cols:
            conn.execute(ddl)
    _ensure_mistake_uid(conn)
    # B2 回填：wrong_review_count ← 入库后的累计再错次数 = 去重重存(times-1) + 复习期答错事件；
    # mastery_state ← 既有字段推导
    _ensure_review_log(conn)
    conn.execute(
        "UPDATE mistakes SET wrong_review_count = COALESCE(times,1)-1 + (SELECT COUNT(*) FROM review_log rl "
        "WHERE rl.mistake_id=mistakes.id AND rl.correct=0) WHERE wrong_review_count IS NULL"
    )
    conn.execute("UPDATE mistakes SET wrong_review_count=0 WHERE wrong_review_count IS NULL")
    conn.execute(
        "UPDATE mistakes SET mastery_state = CASE "
        "WHEN mastered=1 THEN 'mastered' "
        "WHEN wrong_review_count>=2 AND review_streak=0 THEN 'sticky_wrong' "
        "WHEN review_count>0 THEN 'reviewing' ELSE 'new' END "
        "WHERE mastery_state IS NULL"
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_mist_uid ON mistakes(uid, created_at)")
    # 历史 question_type 混存「模块名-细分」与「细分」两种格式，统一回填为细分题型名（幂等）
    conn.execute(
        "UPDATE mistakes SET question_type = trim(substr(question_type, instr(question_type,'-')+1)) "
        "WHERE question_type LIKE '%-%' AND trim(substr(question_type, 1, instr(question_type,'-')-1)) "
        "IN ('资料分析','数量关系','言语理解','判断推理','常识判断','常识','时政')"
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            module TEXT,
            question_type TEXT,
            question TEXT UNIQUE,
            options TEXT,
            answer TEXT,
            explanation TEXT,
            source TEXT
        )"""
    )
    qcols = {r["name"] for r in conn.execute("PRAGMA table_info(questions)")}
    for col, ddl in [
        ("submodule", "ALTER TABLE questions ADD COLUMN submodule TEXT"),
        ("hs_explanation", "ALTER TABLE questions ADD COLUMN hs_explanation TEXT"),
        ("hs_up", "ALTER TABLE questions ADD COLUMN hs_up INTEGER DEFAULT 0"),
        ("hs_down", "ALTER TABLE questions ADD COLUMN hs_down INTEGER DEFAULT 0"),
        ("is_real", "ALTER TABLE questions ADD COLUMN is_real INTEGER DEFAULT 0"),
        ("exam_year", "ALTER TABLE questions ADD COLUMN exam_year INTEGER"),
        ("exam_region", "ALTER TABLE questions ADD COLUMN exam_region TEXT"),
        ("disabled", "ALTER TABLE questions ADD COLUMN disabled INTEGER DEFAULT 0"),
        ("import_batch", "ALTER TABLE questions ADD COLUMN import_batch TEXT"),
        ("image", "ALTER TABLE questions ADD COLUMN image TEXT"),
        ("image_credit", "ALTER TABLE questions ADD COLUMN image_credit TEXT"),
        ("xp_explanation", "ALTER TABLE questions ADD COLUMN xp_explanation TEXT"),
        ("xp_school", "ALTER TABLE questions ADD COLUMN xp_school TEXT"),
        ("has_hs", "ALTER TABLE questions ADD COLUMN has_hs INTEGER DEFAULT 0"),
        ("tag3", "ALTER TABLE questions ADD COLUMN tag3 TEXT"),
        ("quality_score", "ALTER TABLE questions ADD COLUMN quality_score INTEGER"),
        ("updated_at", "ALTER TABLE questions ADD COLUMN updated_at REAL"),
        ("material_hash", "ALTER TABLE questions ADD COLUMN material_hash TEXT"),
    ]:
        if col not in qcols:
            conn.execute(ddl)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS backups (
            code TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at REAL NOT NULL
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_q_module ON questions(module, submodule)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_q_real ON questions(is_real)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_q_tag3 ON questions(tag3)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_q_tag3_disabled ON questions(tag3, disabled)")
    # 抽题池 _pick_scan 带 tag3 时前端总是同时带 module：索引不含 module 就要按 tag3 逐行回宽行表
    # 校验 module（CS-LS-01 9k 行冷读 147 MB）；含 module 的覆盖索引免回表。旧定义存在则重建。
    old = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_q_tag3_pick'"
    ).fetchone()
    if old and "module" not in (old[0] or ""):
        conn.execute("DROP INDEX idx_q_tag3_pick")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_tag3_pick ON questions(tag3, disabled, module, is_real, has_hs, id)"
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_q_quality ON questions(quality_score)")
    # (disabled, id) 是 idx_q_sitemap 的前缀，由 idx_q_active_src 接管「disabled=0 AND id IN (...)」
    conn.execute("DROP INDEX IF EXISTS idx_q_disabled_id")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_sitemap ON questions(disabled, id, updated_at)"
    )
    # 卷库 /api/exam/papers 按卷内 qid 批量取活跃题的 source/is_real：覆盖索引免回表
    # （按主键逐题回表要翻 ~64 MB 冷页，覆盖索引 ~3 MB）
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_active_src ON questions(disabled, id, is_real, source)"
    )
    # 管理台 stats 两个 COUNT 原本各全表扫 ~264 MB（hs_explanation 宽行），部分索引只存命中行 id
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_hs_done ON questions(id) "
        "WHERE hs_explanation IS NOT NULL AND hs_explanation!=''"
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_q_hs_down ON questions(id) WHERE hs_down>0")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_disabled_module ON questions(disabled, module)"
    )
    conn.execute("DROP INDEX IF EXISTS idx_q_disabled_tag3")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_disabled_tag3_upd ON questions(disabled, tag3, updated_at)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_real_region ON questions(is_real, exam_region)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_batch ON questions(import_batch, disabled, is_real, answer)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_real_year ON questions(is_real, disabled, exam_year, module, updated_at)"
    )
    _ensure_question_stat_cols(conn)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_reinforce ON questions(tag3, disabled, correct_ratio, id)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_material ON questions(material_hash, disabled, module) "
        "WHERE material_hash IS NOT NULL"
    )
    # /api/papers 按 source 聚合真题卷：覆盖索引免回表（否则按 idx_q_real_year 回表翻 ~79 MB 冷页）
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_paper_src ON questions(is_real, disabled, source, exam_year, exam_region) "
        "WHERE is_real=1"
    )
    similarity.ensure_tables(conn)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS tag3_review (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at REAL NOT NULL,
            question_id INTEGER NOT NULL,
            tag3 TEXT,
            confidence REAL,
            reason TEXT,
            status TEXT DEFAULT 'open'
        )"""
    )
    if "has_hs" not in qcols:
        conn.execute("UPDATE questions SET has_hs=(hs_explanation IS NOT NULL AND hs_explanation!='')")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_pick ON questions"
        "(module, submodule, is_real, disabled, has_hs, exam_year, exam_region, id)"
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS explain_cache (
            key TEXT PRIMARY KEY,
            created_at REAL NOT NULL,
            module TEXT,
            question_type TEXT,
            question_text TEXT,
            user_answer TEXT,
            explanation TEXT,
            hits INTEGER DEFAULT 0,
            up INTEGER DEFAULT 0,
            down INTEGER DEFAULT 0
        )"""
    )
    # 题库直通（question_id 命中）时记下 qid，讲解首行答案可与题库 answer 直接对账；识题路径/旧行 NULL
    add_column_if_missing(conn, "explain_cache", "qid", "INTEGER")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS shenlun_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exam_year INTEGER,
            exam_region TEXT,
            paper TEXT,
            qtype TEXT,
            material TEXT,
            question TEXT UNIQUE,
            reference TEXT,
            notes TEXT,
            import_batch TEXT,
            disabled INTEGER
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS shenlun_materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            topic TEXT,
            content TEXT UNIQUE,
            source TEXT,
            import_batch TEXT,
            disabled INTEGER
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS shenlun_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT NOT NULL,
            topic TEXT,
            title TEXT,
            content TEXT NOT NULL,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS shizheng_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            question TEXT UNIQUE,
            options TEXT,
            answer TEXT,
            explanation TEXT,
            source_note TEXT,
            created_at REAL
        )"""
    )
    conn.commit()
    conn.close()
    _seed_questions()
    _seed_shizheng()
    conn = get_conn()
    _normalize_option_order(conn)
    conn.commit()
    conn.close()

_MOCK_SRC_RE = re.compile(r"模考|模拟|预测|密卷|冲刺|大赛|专项|练习|刷题")

_PICK_TTL = 600

_pick_cache: dict[tuple, tuple[float, dict]] = {}

_pick_lock = threading.Lock()

_pick_refreshing: set = set()

_pick_build_lock = threading.Lock()

_ZILIAO_HASHES_SQL = (
    "SELECT material_hash FROM questions{indexed} "
    "WHERE module='ziliao' AND material_hash IS NOT NULL AND material_hash!='-' AND disabled=0 "
    "GROUP BY material_hash HAVING COUNT(*)>=2 ORDER BY RANDOM() LIMIT ?"
)

_DIM_CACHE_TTL = 60  # 题库维度聚合（读多写少，仅随导入变化）：60s 进程内缓存

_QCOUNTS_CACHE: list = [0.0, None]

_SUBMOD_COUNTS_CACHE: dict = {}

_REAL_FILTERS_CACHE: list = [0.0, None]

_DAILY_SET_MODULES = ["yanyu", "panduan", "shuliang", "ziliao", "changshi"]

_daily_set_cache: dict[str, list[int]] = {}

_daily_set_lock = threading.Lock()

def cn_day() -> str:
    """中国时区（UTC+8）当日日期 YYYY-MM-DD。"""
    return time.strftime("%Y-%m-%d", time.gmtime(time.time() + 8 * 3600))

def cn_day_start(ts: float | None = None) -> float:
    """中国时区（UTC+8）ts 所在日 00:00 的 Unix 秒。"""
    t = time.time() if ts is None else ts
    return float(int(t + 8 * 3600) // 86400 * 86400 - 8 * 3600)

_TAG3_COUNTS_CACHE: list = [0.0, None]

TAG3_COUNTS_TTL = 300

_YEAR_MODULE_CACHE: list = [0.0, None]

_UPDATED_AT_EPOCH = (
    "CASE WHEN typeof(updated_at)='text' THEN CAST(strftime('%s', updated_at) AS REAL) "
    "ELSE updated_at END"
)

_TAG3_LASTMOD_CACHE: list = [0.0, None]

PRACTICE_POOL = "n>0 AND probe=0"

_REPORT_STATUS_ALIASES = {"fixed": ("fixed", "resolved"), "rejected": ("rejected", "dismissed"), "open": ("open",)}

ADMIN_EDITABLE = {"answer", "explanation", "hs_explanation", "submodule", "question", "disabled", "module", "exam_year", "exam_region", "is_real", "tag3", "options"}

VALID_MODULES = {"ziliao", "shuliang", "yanyu", "panduan", "changshi"}

_SUB_PREFIXES = (
    "数学运算-", "数量关系-", "资料分析-", "言语理解-", "言语理解与表达-",
    "判断推理-", "逻辑判断-", "常识判断-", "常识-", "综合题组-",
)

_SUB_SYNONYMS = {
    "溶液问题": "浓度问题",
    "经济利润问题": "经济利润",
    "行程": "行程问题",
    "工程": "工程问题",
    "排列组合与概率问题": "排列组合与概率",
    "排列组合": "排列组合与概率",
    "概率问题": "排列组合与概率",
    "概率": "排列组合与概率",
    "几何": "几何问题",
    "逻辑填空（实词/成语辨析）": "逻辑填空",
    "中心理解题": "中心理解",
    "主旨概括": "中心理解",
    "细节理解题": "细节理解",
    "细节判断": "细节理解",
    "法律常识": "法律",
    "科技常识": "科技",
    "政治常识": "政治",
    "经济常识": "经济",
    "地理常识": "地理",
    "人文": "历史人文",
    "人文常识": "历史人文",
    "历史常识": "历史人文",
    "理论政策": "政治",
    "理论": "政治",
}

_SUB_COLLAPSE = ("类比推理", "定义判断", "图形推理")

SUBMODULE_MERGE = {
    "changshi": {
        "公文": "管理与公文", "应急": "管理与公文",
        "地理": "地理国情",
        "环保": "生态", "环境": "生态",
        "婚家": "婚姻",
        "消保": "消费",
        "个人信息": "个保",
        "未保": "未成年",
        "科技常识": "科技", "科技-物理": "科技", "物理": "科技",
        "网安": "网络",
        "道交": "交通",
    },
    "shuliang": {
        "钟表问题": "周期与日期", "敲钟问题": "周期与日期",
        "牛吃草问题": "工程问题",
        "抽屉原理": "最值问题", "最不利原则": "最值问题", "构造类问题": "最值问题",
        "和倍问题": "计算问题", "还原问题": "计算问题", "平均数问题": "计算问题",
        "不定方程": "计算问题", "盈亏问题": "计算问题", "鸡兔同笼": "计算问题",
        "植树问题": "植树与方阵", "方阵问题": "植树与方阵", "锯木问题": "植树与方阵",
        "数列问题": "数字推理", "数字推理-多重数列": "数字推理",
        "爬楼问题": "行程问题", "队列问题": "行程问题",
    },
    "yanyu": {
        "意图判断": "中心理解", "片段阅读": "中心理解",
        "词句理解": "细节理解",
        "语句排序": "语句表达", "语句填空": "语句表达", "接语选择": "语句表达",
    },
    "panduan": {"逻辑推理": "逻辑判断"},
    "ziliao": {
        "基期现期": "基期与现期", "基期量": "基期与现期", "现期量": "基期与现期",
        "增长问题": "增长率", "比重问题": "比重",
        "简单计算": "简单计算与读数",
        "平均数": "平均数与倍数", "倍数": "平均数与倍数",
    },
}

def normalize_submodule(sub: str | None) -> str | None:
    if not sub:
        return sub
    s = str(sub).strip()
    for c in _SUB_COLLAPSE:
        if s.startswith((c + "-", c + "：")):
            return c
    for p in _SUB_PREFIXES:
        if s.startswith(p):
            s = s[len(p):]
            break
    return _SUB_SYNONYMS.get(s, s) or None

_RESIDUE_RE = re.compile(r"[一二三四五六七八九十]、|第[一二三四五]部分|共\d+题")

def normalize_answer(raw, opts: dict | None = None) -> str:
    """答案字母归一：去空白、大写、去重、按字母升序（多选题 'DB' -> 'BD'）。

    传 opts 时任一字母不在选项键内返回 ''（调用方按无效处理）。"""
    letters = sorted({ch for ch in str(raw or "").strip().upper() if "A" <= ch <= "Z"})
    if opts is not None:
        keys = {str(k).strip().upper() for k in opts}
        if not letters or any(ch not in keys for ch in letters):
            return ""
    return "".join(letters)

def options_json(opts) -> str:
    """选项落库序列化：键全为单个大写字母时按 A/B/C/D 升序（多端展示按键序枚举）。"""
    if not isinstance(opts, dict):
        opts = {}
    keys = list(opts)
    if keys and all(isinstance(k, str) and len(k) == 1 and "A" <= k <= "Z" for k in keys):
        opts = {k: opts[k] for k in sorted(keys)}
    return json.dumps(opts, ensure_ascii=False)

def _normalize_option_order(conn):
    """历史题 options 键序按导入 JSON 原样落库（如 A/D/B/C），一次性重写为字母序。"""
    _ensure_seed_tables(conn)
    flag = "__option_order_v1"
    if conn.execute("SELECT 1 FROM seed_runs WHERE path=?", (flag,)).fetchone():
        return 0
    fixed = 0
    for table in ("questions", "shizheng_questions"):
        rows = conn.execute(f"SELECT id, options FROM {table} WHERE options IS NOT NULL").fetchall()
        for r in rows:
            d = _parse_options(r["options"])
            if not d:
                continue
            norm = options_json(d)
            if norm != r["options"]:
                conn.execute(f"UPDATE {table} SET options=? WHERE id=?", (norm, r["id"]))
                fixed += 1
    conn.execute(
        "INSERT OR REPLACE INTO seed_runs (path, fingerprint, ran_at) VALUES (?,?,?)", (flag, str(fixed), time.time())
    )
    return fixed

def _bad_options(opts: dict) -> bool:
    vals = [str(v).strip() for v in opts.values()]
    if len(vals) < 2 or any(not v for v in vals) or len(set(vals)) < len(vals):
        return True
    return any(len(v) > 120 or _RESIDUE_RE.search(v) for v in vals)

REAL_TRAFFIC = "COALESCE(probe,0)=0"

def add_column_if_missing(conn, table: str, column: str, ddl_type: str) -> bool:
    """幂等加列：并发首请求同时迁移时后到者会碰 duplicate column，视为已存在而非错误。"""
    cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
    if column in cols:
        return False
    try:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}")
    except sqlite3.OperationalError as e:
        if "duplicate column" not in str(e).lower():
            raise
        return False
    return True

def foreign_module_qid(module, qid):
    """时政等非行测模块的题号属于别的表（shizheng_questions），与 questions.id 只是数字撞号；
    落 answer_log / mistakes 时置空，否则按题号的统计、去重、复习推进会算到无关的行测题上。"""
    return bool(qid) and isinstance(module, str) and bool(module) and module not in VALID_MODULES

def _pos_int(v) -> int | None:
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v if v > 0 else None
    if isinstance(v, str) and v.isdigit():
        return int(v) or None
    return None

CLIENT_TS_PAST_S = 30 * 86400

CLIENT_TS_FUTURE_S = 300

def _client_ts(raw, now: float) -> float:
    """客户端自报作答时刻（秒或毫秒）；仅接受 [now-30d, now+5min] 内的数值，否则回退 now。"""
    if isinstance(raw, bool) or not isinstance(raw, (int, float)) or not math.isfinite(raw):
        return now
    ts = float(raw)
    if ts > 1e11:
        ts /= 1000
    if now - CLIENT_TS_PAST_S <= ts <= now + CLIENT_TS_FUTURE_S:
        return ts
    return now

_HISTORY_SESSION_GAP = 1800  # 相邻作答间隔超过该秒数即切分为新一次练习

_PAPER_TITLE_RE = re.compile(r"(\d{4}年[^（(）).]{2,40}《行测》(?:真题|试卷|试题)?(?:（[^）]{1,8}）)?)")

def _today_str() -> str:
    return time.strftime("%Y-%m-%d", time.gmtime(time.time() + 8 * 3600))

_ATTEMPT_DEDUPE_SECS = 3

FREQ_WEIGHT = {
    "ziliao": 1.0, "panduan": 0.9, "yanyu": 0.9, "shuliang": 0.7, "changshi": 0.6,
}

TAG3_MIN_N = 5

def _parse_options(raw: str | None) -> dict | None:
    if not raw:
        return None
    try:
        d = json.loads(raw)
        return d if isinstance(d, dict) and d else None
    except (ValueError, TypeError):
        return None

def _uid_clause(uid: str | None) -> tuple[str, tuple]:
    """按 uid 严格隔离；无 uid 的调用只见无归属记录。"""
    if not uid:
        return " AND uid IS NULL", ()
    return " AND uid=?", (uid,)

def clean_uid(uid) -> str:
    """uid 归一：去空白截 64；空串由调用方决定是否 400。"""
    return str(uid or "").strip()[:64]

def display_alias(uid: str, nickname: str | None) -> str:
    """榜单展示名：昵称优先（去空白截 20），缺失时用 uid 派生的稳定化名，不暴露 uid。"""
    n = str(nickname or "").strip()[:20]
    if n and n.lower() not in ("null", "undefined"):
        return n
    h = hashlib.sha1(str(uid or "").encode()).hexdigest()[:4].upper()
    return f"考友{h}"

_QTYPE_MOD_PREFIXES = ("资料分析", "数量关系", "言语理解", "判断推理", "常识判断", "常识", "时政")

def norm_qtype(question_type) -> str | None:
    """题型统一为细分题型名：去掉「模块名-」前缀（模块归属已由 module 字段承担）。"""
    t = str(question_type or "").strip()
    if not t:
        return None
    head, sep, rest = t.partition("-")
    if sep and head in _QTYPE_MOD_PREFIXES and rest.strip():
        return rest.strip()
    return t

REVIEW_INTERVALS_DAYS = [1, 3, 7, 15, 30]

MODULE_ORDER = ["changshi", "yanyu", "shuliang", "panduan", "ziliao"]

_PAPERS_CACHE_TTL = 300

_papers_cache: dict[tuple, tuple[float, list[dict]]] = {}

_papers_refreshing: set[tuple] = set()

_papers_lock = threading.Lock()

_PSOURCE_MIN_N = 20  # 对齐练习流按卷启动的最少题数守卫

_SOCIAL_MIN_N = 5  # 卷卡「N 人考过 · 平均分」至少真人样本，低于此不外显

PROFILE_FIELDS = (
    "exam_type",
    "target_region",
    "exam_date",
    "target_score",
    "daily_minutes",
    "base_level",
    "daily_goal",
    "group_size",
    "timed_mode",
    "auto_next",
    "theme_mode",
    "theme_accent",
)

def _day_start(offset_days: int = 0) -> float:
    """东八区当日 0 点时间戳（offset_days 偏移若干天）。"""
    return cn_day_start() + offset_days * 86400

_ADMIN_CACHE: dict = {}

_admin_cache_lock = threading.Lock()

_admin_refreshing: set = set()

_admin_build_lock = threading.Lock()

def _cached_refresh(key: str, fn):
    try:
        data = fn()
        with _admin_cache_lock:
            _ADMIN_CACHE[key] = (time.time(), data)
    except Exception:
        pass
    finally:
        with _admin_cache_lock:
            _admin_refreshing.discard(key)

def _cached(key: str, ttl: float, fn):
    return _cached_state(key, ttl, fn)[0]

def _cached_state(key: str, ttl: float, fn):
    """2G 小服务器上重查询的进程内缓存：过期先回旧值并后台单飞重算
    （stale-while-revalidate，对齐 _pick_pools），请求不承担秒级重查询。
    返回 (数据, 命中态)：hit=TTL 内命中，stale=过期回旧值，cold=进程启动后首次同步构建。"""
    with _admin_cache_lock:
        hit = _ADMIN_CACHE.get(key)
        if hit:
            if time.time() - hit[0] < ttl:
                return hit[1], "hit"
            if key not in _admin_refreshing:
                _admin_refreshing.add(key)
                threading.Thread(target=_cached_refresh, args=(key, fn), daemon=True).start()
            return hit[1], "stale"
    # 冷 miss（进程启动后首次）：单线程构建，同键并发等锁后直接吃缓存
    with _admin_build_lock:
        with _admin_cache_lock:
            hit = _ADMIN_CACHE.get(key)
            if hit:
                return hit[1], "cold"
        data = fn()
        with _admin_cache_lock:
            _ADMIN_CACHE[key] = (time.time(), data)
        return data, "cold"

MASTERY_PRIOR_K = 12          # 与 insights.PRIOR_K 同参

MASTERY_PRIOR_ACC = 0.55      # 与 insights.PRIOR_ACC 同参

MASTERY_HALF_LIFE_DAYS = 30   # 时间衰减半衰期

MASTERY_COLD_START_N = 30     # 与 insights.COLD_START_N 同口径

MASTERY_LEVELS = [
    ("rumen", "入门", 0.55),
    ("gonggu", "巩固", 0.7),
    ("shulian", "熟练", 0.85),
    ("jingtong", "精通", 1.01),
]

_MASTERY_CACHE: dict = {}

MASTERY_CACHE_TTL = 60

REINFORCE_N = 5

REINFORCE_REASONS = ("方法不会", "概念不清")

MODULE_NAMES = {
    "ziliao": "资料分析", "shuliang": "数量关系", "yanyu": "言语理解",
    "panduan": "判断推理", "changshi": "常识判断",
}

from .db_admin import *
from .db_daily import *
from .db_exam import *
from .db_mastery import *
from .db_practice import *
from .db_qbank import *
from .db_reports import *
from .db_review import *

# 域模块 re-export：from .db import xxx 调用方零改动；域文件经 `from . import db` 回调，规避循环导入。
from .db_seed import *
from .db_shenlun import *
from .db_social import *
from .db_stats import *
from .db_taxonomy import *
from .db_user import *
