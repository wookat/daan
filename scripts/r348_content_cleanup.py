#!/usr/bin/env python3
"""r348 内容治理：下线 hs 自检失败题 / 伪中文 yanyu AI 批次题，剥离 hs 管线括注。

规则（口径与 backend/app/quality.py 共用同一常量/正则）：
  a. 在线题 hs_explanation 含自检失败词（SKIP:/数据矛盾/官方解析有误/无法用给定）
     → disabled=1，note 追加 r348:hs-selfcheck
  b. 在线题 hs_explanation 含「（通用解法，…不在库中）」括注 → 整体删除、空白归一、rescore_question
  c. module='yanyu' AND import_batch LIKE 'b2026%' 在线题，题干+选项伪中文命中 ≥3
     → disabled=1，note 追加 r348:pseudo-zh

默认 dry-run 只打印计数与样例 id；`--apply` 才写库（写前备份到 <db>.bak-r348，已存在则不覆盖）。
本地：DB_PATH=/path/data.db python3 scripts/r348_content_cleanup.py [--apply] [--dump ids.json]
生产：sudo docker exec -i deploy-kaogong-1 python3 - [--apply] < scripts/r348_content_cleanup.py
"""
import argparse
import json
import os
import sqlite3
import sys
import time
from collections import Counter

try:
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
except NameError:  # 经 stdin 管道运行（容器内 cwd=/app/backend 可直接 import app）
    pass

from app import db, quality

ONLINE = "(disabled IS NULL OR disabled=0)"
YANYU_AI_BATCH_LIKE = "b2026%"
NOTE_SELFCHECK = "r348:hs-selfcheck;"
NOTE_PSEUDO_ZH = "r348:pseudo-zh;"
SAMPLE_N = 10


def scan(conn):
    # a. hs 自检失败
    like = " OR ".join("hs_explanation LIKE ?" for _ in quality.HS_SELFCHECK_WORDS)
    rows = conn.execute(
        f"SELECT id, module, hs_explanation FROM questions WHERE {ONLINE} AND ({like})",
        tuple(f"%{w}%" for w in quality.HS_SELFCHECK_WORDS),
    ).fetchall()
    selfcheck = [dict(r) for r in rows if quality.hs_selfcheck_failed(r["hs_explanation"] or "")]

    # b. 管线括注
    rows = conn.execute(
        f"SELECT id, module, hs_explanation FROM questions WHERE {ONLINE} "
        "AND hs_explanation LIKE '%（通用解法，%不在库中）%'"
    ).fetchall()
    note_rows = []
    for r in rows:
        hs = r["hs_explanation"] or ""
        m = quality.HS_PIPELINE_NOTE_RE.search(hs)
        if not m:
            continue
        d = dict(r)
        d["mid"] = bool(hs[: m.start()].strip()) and bool(hs[m.end():].strip())  # 前后都有正文 = 句中变体
        d["new_hs"] = quality.sanitize_hs(hs)
        note_rows.append(d)

    # c. yanyu AI 批次伪中文
    rows = conn.execute(
        f"SELECT id, module, question, options FROM questions WHERE {ONLINE} "
        "AND module='yanyu' AND import_batch LIKE ?",
        (YANYU_AI_BATCH_LIKE,),
    ).fetchall()
    pseudo = []
    for r in rows:
        hits = quality.pseudo_zh_hits(quality.question_text(dict(r)))
        if hits >= quality.PSEUDO_ZH_MIN_HITS:
            d = dict(r)
            d["hits"] = hits
            pseudo.append(d)
    return {"selfcheck": selfcheck, "note": note_rows, "pseudo": pseudo, "yanyu_ai_scanned": len(rows)}


def online_by_module(conn) -> dict:
    return {
        r["module"]: r["n"]
        for r in conn.execute(f"SELECT module, COUNT(*) n FROM questions WHERE {ONLINE} GROUP BY module")
    }


def report(res: dict, before: dict):
    sc, nt, ps = res["selfcheck"], res["note"], res["pseudo"]
    print(f"[a] hs-selfcheck online hits: {len(sc)}  by module: {dict(Counter(r['module'] for r in sc))}")
    by_word = Counter(w for r in sc for w in quality.HS_SELFCHECK_WORDS if w in (r["hs_explanation"] or ""))
    print("    by word:", dict(by_word), " ids:", [r["id"] for r in sc])
    for r in sc[:SAMPLE_N]:
        hs = r["hs_explanation"] or ""
        i = min(hs.find(w) for w in quality.HS_SELFCHECK_WORDS if w in hs)
        print(f"    #{r['id']} {r['module']}: {hs[max(0, i - 40):i + 40]!r}")
    mid = sum(1 for r in nt if r["mid"])
    print(f"[b] pipeline-note online hits: {len(nt)} (mid-sentence variants {mid})  by module: {dict(Counter(r['module'] for r in nt))}")
    print("    sample ids:", [r["id"] for r in nt[:SAMPLE_N]])
    for r in nt[:2]:
        hs = r["hs_explanation"] or ""
        m = quality.HS_PIPELINE_NOTE_RE.search(hs)
        print(f"    #{r['id']} before: {hs[max(0, m.start() - 30):m.end() + 30]!r}")
        print(f"    #{r['id']} after : {(r['new_hs'] or '')[max(0, m.start() - 30):m.start() + 30]!r}")
    print(f"[c] yanyu AI-batch pseudo-zh hits: {len(ps)} / scanned {res['yanyu_ai_scanned']}")
    print("    sample ids:", [r["id"] for r in ps[:SAMPLE_N]])
    for r in ps[:3]:
        print(f"    #{r['id']} hits={r['hits']} q: {(r['question'] or '')[:60]!r}")
    off = {r["id"]: r["module"] for r in sc + ps}
    print(f"to disable (a∪c, dedup): {len(off)}; to rewrite hs (b): {len(nt)}")
    off_by_mod = Counter(off.values())
    print("online by module ->", {m: (n, n - off_by_mod.get(m, 0)) for m, n in sorted(before.items(), key=str)})


def apply(conn, res: dict):
    now = time.time()
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(questions)")}
    if "note" not in cols:
        conn.execute("ALTER TABLE questions ADD COLUMN note TEXT")
    for r in res["note"]:
        if r["new_hs"] is None:  # 同时命中 a，留原文随下线存档
            continue
        conn.execute(
            "UPDATE questions SET hs_explanation=?, updated_at=? WHERE id=?",
            (r["new_hs"], now, r["id"]),
        )
        db.rescore_question(conn, r["id"])
    for key, note in (("selfcheck", NOTE_SELFCHECK), ("pseudo", NOTE_PSEUDO_ZH)):
        for r in res[key]:
            conn.execute(
                f"UPDATE questions SET disabled=1, note=COALESCE(note,'') || ?, updated_at=? "
                f"WHERE id=? AND {ONLINE}",
                (note, now, r["id"]),
            )
    conn.commit()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="写库（默认 dry-run）")
    ap.add_argument("--db", default=os.environ.get("DB_PATH", "/data/data.db"))
    ap.add_argument("--dump", help="把命中 id 台账写成 JSON")
    args = ap.parse_args()

    if args.apply:
        conn = sqlite3.connect(args.db, timeout=30)
    else:
        conn = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True, timeout=30)
    conn.row_factory = sqlite3.Row
    before = online_by_module(conn)
    res = scan(conn)
    report(res, before)
    if args.dump:
        with open(args.dump, "w", encoding="utf-8") as f:
            json.dump(
                {k: [r["id"] for r in res[k]] for k in ("selfcheck", "note", "pseudo")},
                f, ensure_ascii=False,
            )
        print("dumped ids ->", args.dump)
    if not args.apply:
        print("dry-run only; pass --apply to write")
        conn.close()
        return
    bak = args.db + ".bak-r348"
    if os.path.exists(bak):
        print("backup exists, keep:", bak)
    else:
        with sqlite3.connect(bak) as dst:  # 在线一致快照（含 WAL 未 checkpoint 页），等价 cp
            conn.backup(dst)
        print("backup ->", bak)
    apply(conn, res)
    after = online_by_module(conn)
    print("online by module after:", {m: (before.get(m, 0), after.get(m, 0)) for m in sorted(before, key=str)})
    remain = scan(conn)
    print("re-scan after apply:", {k: len(remain[k]) for k in ("selfcheck", "note", "pseudo")})
    conn.close()


if __name__ == "__main__":
    main()
