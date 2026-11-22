"""UX 深度审查修复回归测试：国考 region 自动回填、模考优先完整 5 模块卷、真题元数据修复与存量补挂脚本。"""
import importlib.util
import json
from pathlib import Path

from app import db
from app.services import mock_event

SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"


def _load_script(name: str):
    path = SCRIPTS_DIR / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _insert_questions(conn, counts: dict[str, int], source: str = "2026年国考副省级行测真题", is_real: int = 1) -> list[int]:
    qids = []
    for mod, cnt in counts.items():
        for i in range(cnt):
            cur = conn.execute(
                "INSERT INTO questions (module, submodule, question, options, answer, explanation, source, is_real, disabled) "
                "VALUES (?,?,?,?,?,?,?,?,0)",
                (mod, "综合", f"{source}-{mod}-{i}", json.dumps({"A": "1", "B": "2"}), "A", "解析", source, is_real),
            )
            qids.append(cur.lastrowid)
    return qids


def test_xt_zhenti_region_of_tags_guokao():
    mod = _load_script("xt_zhenti_apply")
    assert mod.region_of("2026年国考副省级行测真题", "") == "国考"
    assert mod.region_of("2025年国家公务员录用考试行测（地市级）", "") == "国考"
    assert mod.region_of("2026年四川省公务员行测真题", "") == "四川"
    assert mod.region_of("2025年某卷", "江苏") == "江苏"


def test_ensure_exam_tables_idempotently_backfills_guokao_region(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "test.db"))
    db.init_db()
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, duration_min, question_ids, created_at) VALUES (?,?,?,?,?,?,1.0)",
        ("2026年国考副省级行测真题", "zhenti", 2026, "", 120, "[1,2]"),
    )
    conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, duration_min, question_ids, created_at) VALUES (?,?,?,?,?,?,1.0)",
        ("2025年国家公务员考试行测（行政执法）", "zhenti", 2025, None, 120, "[1,2]"),
    )
    conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, duration_min, question_ids, created_at) VALUES (?,?,?,?,?,?,1.0)",
        ("2025年浙江省考行测真题", "zhenti", 2025, "", 120, "[1,2]"),
    )
    conn.commit()

    # 模拟服务重启：清掉内存 ensured 缓存后再跑 _ensure_exam_tables，自动幂等回填国考 region 且不误改省考
    db._ENSURED_TABLES.clear()
    db._ensure_exam_tables(conn)
    rows = dict(conn.execute("SELECT title, region FROM exam_papers").fetchall())
    conn.close()
    assert rows["2026年国考副省级行测真题"] == "国考"
    assert rows["2025年国家公务员考试行测（行政执法）"] == "国考"
    assert rows["2025年浙江省考行测真题"] == ""


def test_mock_event_pick_paper_prefers_complete_5mod_100_to_150_paper(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "mock.db"))
    db.init_db()
    mock_event.init_mock_event_db()
    conn = db.get_conn()
    db._ensure_exam_tables(conn)

    # 1. 不完整卷：110 题但缺 ziliao
    q_miss = _insert_questions(conn, {"changshi": 20, "yanyu": 35, "shuliang": 15, "panduan": 40}, source="残卷A")
    cur_miss = conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, duration_min, question_ids, created_at) VALUES (?,?,?,?,?,?,1.0)",
        ("2026缺资料卷", "zhenti", 2026, "四川", 120, json.dumps(q_miss)),
    )
    # 2. 题量不足卷：70 题（虽五模块齐全）
    q_short = _insert_questions(conn, {"changshi": 10, "yanyu": 20, "shuliang": 10, "panduan": 20, "ziliao": 10}, source="短卷B")
    conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, duration_min, question_ids, created_at) VALUES (?,?,?,?,?,?,1.0)",
        ("2026短卷", "zhenti", 2026, "广东", 120, json.dumps(q_short)),
    )
    # 3. 超长合卷：170 题
    q_huge = _insert_questions(conn, {"changshi": 30, "yanyu": 40, "shuliang": 20, "panduan": 50, "ziliao": 30}, source="合卷C")
    conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, duration_min, question_ids, created_at) VALUES (?,?,?,?,?,?,1.0)",
        ("2026合卷", "zhenti", 2026, "国考", 120, json.dumps(q_huge)),
    )
    # 4. 完整标准卷：120 题五模块齐全
    q_full = _insert_questions(conn, {"changshi": 20, "yanyu": 30, "shuliang": 10, "panduan": 40, "ziliao": 20}, source="标准卷D")
    cur_full = conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, duration_min, question_ids, created_at) VALUES (?,?,?,?,?,?,1.0)",
        ("2025标准完整国考卷", "zhenti", 2025, "国考", 120, json.dumps(q_full)),
    )
    conn.commit()

    picked = mock_event._pick_paper_id(conn)
    assert picked == cur_full.lastrowid
    assert picked != cur_miss.lastrowid
    conn.close()


def test_fix_zhenti_metadata_plan_readonly_and_apply_reattach(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "fix.db"))
    db.init_db()
    conn = db.get_conn()
    db._ensure_exam_tables(conn)

    # 先插入一套 80 题缺资料的真题，另外在 questions 表里放 20 道同 source 的资料分析未挂入卷内
    src = "2025年国考地市级行测真题"
    attached = _insert_questions(conn, {"changshi": 15, "yanyu": 25, "shuliang": 10, "panduan": 30}, source=src)
    extras = _insert_questions(conn, {"ziliao": 20}, source=src)
    cur = conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, duration_min, question_ids, created_at) VALUES (?,?,?,?,?,?,1.0)",
        (src, "zhenti", 2025, "", 120, json.dumps(attached)),
    )
    pid = cur.lastrowid
    conn.commit()
    conn.close()

    script = _load_script("fix_zhenti_metadata")

    # --plan 必须只读，准确报告 1 套未标 region 国考卷 + 1 套可补挂 20 题
    plan = script.audit_and_fix(apply=False, reattach=False)
    assert plan["untagged_guokao"] == 1
    assert plan["reattach_candidates"] == 1
    assert plan["reattached_papers"] == 0
    assert plan["sample_reattach"][0]["add"] == 20
    assert plan["sample_reattach"][0]["add_mods"] == {"ziliao": 20}

    # 确认 --plan 没有改动数据库
    conn = db.get_conn()
    row = conn.execute("SELECT region, question_ids FROM exam_papers WHERE id=?", (pid,)).fetchone()
    conn.close()
    assert row["region"] == ""
    assert len(json.loads(row["question_ids"])) == 80

    # --apply --reattach 写入修复
    applied = script.audit_and_fix(apply=True, reattach=True)
    assert applied["untagged_guokao"] == 1
    assert applied["reattached_papers"] == 1
    assert applied["reattached_questions"] == 20

    conn = db.get_conn()
    row = conn.execute("SELECT region, question_ids FROM exam_papers WHERE id=?", (pid,)).fetchone()
    qids = json.loads(row["question_ids"])
    conn.close()
    assert row["region"] == "国考"
    assert len(qids) == 100
    assert set(extras).issubset(set(qids))

    # 再次运行幂等（0 未标、0 待补挂）
    second = script.audit_and_fix(apply=True, reattach=True)
    assert second["untagged_guokao"] == 0
    assert second["reattach_candidates"] == 0
    assert second["reattached_papers"] == 0
