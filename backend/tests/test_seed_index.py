"""R376：种子题库导入以 seed_index 去重——种子题被改写/下线/删除后重启不再重插（2026-09-04 事故：题干改写→重启重插 1928 条）。"""
import json
import os
import tempfile

from app import db

PFX = "R376种子题 "


def _write_bank(path, stems):
    lines = [
        json.dumps(
            {
                "module": "yanyu",
                "question_type": "单选题",
                "question": s,
                "options": {"A": "甲 乙", "B": "丙 丁", "C": "戊", "D": "己"},
                "answer": "A",
                "explanation": f"解析 {i}",
                "submodule": "逻辑填空",
            },
            ensure_ascii=False,
        )
        + "\n"
        for i, s in enumerate(stems)
    ]
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(lines)


def _count(like=PFX + "%"):
    conn = db.get_conn()
    n = conn.execute("SELECT COUNT(*) FROM questions WHERE question LIKE ?", (like,)).fetchone()[0]
    conn.close()
    return n


def _cleanup(stems):
    conn = db.get_conn()
    conn.execute("DELETE FROM questions WHERE question LIKE ?", (PFX + "%",))
    conn.execute("DELETE FROM questions WHERE question LIKE ?", ("R376改后 %",))
    for s in stems:
        conn.execute(
            "DELETE FROM seed_index WHERE stem_hash=?",
            (db.hashlib.sha1(s.encode("utf-8")).hexdigest(),),
        )
    conn.execute("DELETE FROM seed_runs WHERE path LIKE '%r376%'")
    conn.commit()
    conn.close()


def _bank(tmp, name, stems):
    path = os.path.join(tmp, f"r376-{name}.jsonl")
    _write_bank(path, stems)
    return path


def test_rewritten_seed_stem_not_reinserted_on_next_run():
    stems = [PFX + f"改写-{i}" for i in range(3)]
    tmp = tempfile.mkdtemp(prefix="kg-r376-")
    path = _bank(tmp, "rewrite", stems)
    _cleanup(stems)
    assert db._seed_questions(path) == 3
    assert _count() == 3

    conn = db.get_conn()
    qid = conn.execute("SELECT id FROM questions WHERE question=?", (stems[0],)).fetchone()["id"]
    conn.close()
    assert db.admin_update_question(qid, {"question": "R376改后 " + stems[0]})

    # 文件未变：整体跳过，不重插
    assert db._seed_questions(path) == 0
    assert _count() == 2 and _count("R376改后 %") == 1

    # 文件变了（追加 1 题）：只插新题，被改写的种子题仍不重插
    _write_bank(path, stems + [PFX + "追加-9"])
    assert db._seed_questions(path) == 1
    assert _count() == 3 and _count("R376改后 %") == 1
    _cleanup(stems + [PFX + "追加-9"])


def test_deleted_or_disabled_seed_not_resurrected():
    stems = [PFX + f"删除-{i}" for i in range(2)]
    tmp = tempfile.mkdtemp(prefix="kg-r376-")
    path = _bank(tmp, "delete", stems)
    _cleanup(stems)
    assert db._seed_questions(path) == 2
    conn = db.get_conn()
    conn.execute("DELETE FROM questions WHERE question=?", (stems[0],))
    conn.execute("UPDATE questions SET disabled=1 WHERE question=?", (stems[1],))
    conn.commit()
    conn.close()
    _write_bank(path, stems + [PFX + "删除-新"])  # 改文件强制重扫
    assert db._seed_questions(path) == 1
    assert _count(stems[0]) == 0
    conn = db.get_conn()
    assert conn.execute("SELECT disabled FROM questions WHERE question=?", (stems[1],)).fetchone()[0] == 1
    conn.close()
    _cleanup(stems + [PFX + "删除-新"])


def test_upgrade_backfills_index_for_existing_rows_without_duplicates():
    """升级路径：库里已有按题干原文导入的种子题、seed_index 为空 → 首次运行按原文回填映射，0 插入。"""
    stems = [PFX + f"回填-{i}" for i in range(3)]
    tmp = tempfile.mkdtemp(prefix="kg-r376-")
    path = _bank(tmp, "backfill", stems)
    _cleanup(stems)
    conn = db.get_conn()
    for s in stems:
        conn.execute(
            "INSERT INTO questions (module, question_type, question, options, answer, updated_at) VALUES (?,?,?,?,?,?)",
            ("yanyu", "单选题", s, "{}", "A", 0),
        )
    conn.commit()
    ids = {r[0] for r in conn.execute("SELECT id FROM questions WHERE question LIKE ?", (PFX + "回填-%",))}
    conn.close()
    assert db._seed_questions(path) == 0
    assert _count(PFX + "回填-%") == 3
    conn = db.get_conn()
    mapped = {
        r[0]
        for r in conn.execute(
            "SELECT question_id FROM seed_index WHERE stem_hash IN ({})".format(",".join("?" * len(stems))),
            [db.hashlib.sha1(s.encode("utf-8")).hexdigest() for s in stems],
        )
    }
    sub = conn.execute("SELECT submodule FROM questions WHERE id=?", (next(iter(ids)),)).fetchone()[0]
    conn.close()
    assert sub == "逻辑填空"
    assert mapped == ids
    _cleanup(stems)
