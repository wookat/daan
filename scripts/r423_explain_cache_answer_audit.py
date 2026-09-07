#!/usr/bin/env python3
"""r423 讲解缓存答案对账：explain_cache 每行讲解首行「【答案】X」 vs 题库 questions.answer。

匹配口径与 engine.extract_from_qbank 一致：题库题干去空白前 40 字 ⊂ 缓存 question_text 去空白（有 qid 列时优先按 qid）。
分类：
  OK              首行答案 ∈ 命中题的 answer
  CONFLICT        命中且题活跃、首行答案与所有命中题 answer 都不同  ← 唯一会被 --apply 删除的类
  MATCH_DISABLED  命中题全 disabled（用户不可见，不动）
  SUSPECT         讲解为「题目存疑」（识题失败/缺选项，不是答案错）
  NO_FIRST        首行无【答案】标记（旧格式/追问）
  UNMATCHED       题库无命中（手输/拍照的非题库题，无法对账）

CONFLICT 行是缓存住的错答案讲解（生产 R423 实查 6 行：题库 answer 与题库解析、hs 解析三方一致，缓存首行相反），
删除后下次讲解按 R421 直通路径带 known_answer 重新生成；不改题库、不改缓存正文。

  默认 dry-run；--apply 只删 CONFLICT，写前把被删行全字段落到 --record；--restore FILE 按原 key 重插。

本地：DB_PATH=/path/data.db python3 scripts/r423_explain_cache_answer_audit.py [--apply --record r423.json]
生产：docker exec -i deploy-kaogong-1 python3 - --apply --record /data/r423-explain-cache-conflicts.json < scripts/r423_explain_cache_answer_audit.py
"""
import argparse
import json
import os
import re
import sqlite3
import time

FIRST = re.compile(r"【答案】\s*([A-Ha-h]{1,4}|题目存疑)")
HEAD_LEN = 40


def _sq(s: str | None) -> str:
    return re.sub(r"\s+", "", s or "")


def first_answer(explanation: str | None) -> str | None:
    """讲解首行的【答案】标记：字母串（大写）/「题目存疑」/None。"""
    line = (explanation or "").strip().split("\n", 1)[0][:120]
    m = FIRST.search(line)
    return m.group(1).upper() if m else None


def _cols(conn: sqlite3.Connection) -> list[str]:
    return [r[1] for r in conn.execute("PRAGMA table_info(explain_cache)")]


def scan(conn: sqlite3.Connection, verbose: bool = True) -> dict:
    cols = _cols(conn)
    has_qid = "qid" in cols
    rows = [dict(zip(cols, r)) for r in conn.execute(f"SELECT {','.join(cols)} FROM explain_cache ORDER BY created_at")]
    for r in rows:
        r["_text"] = _sq(r.get("question_text"))
        r["_ans"] = first_answer(r.get("explanation"))
        r["_match"] = []
    by_text = [r for r in rows if not (has_qid and r.get("qid"))]
    for q in conn.execute("SELECT id, question, answer, COALESCE(disabled,0) d FROM questions"):
        stem = _sq(q[1])
        if len(stem) < 8:
            continue
        head = stem[:HEAD_LEN]
        hit = (q[0], (q[2] or "").strip().upper(), int(q[3]))
        for r in by_text:
            if head in r["_text"]:
                r["_match"].append(hit)
        if has_qid:
            for r in rows:
                if r.get("qid") == q[0]:
                    r["_match"].append(hit)
    stat = {k: 0 for k in ("OK", "CONFLICT", "MATCH_DISABLED", "SUSPECT", "NO_FIRST", "UNMATCHED")}
    conflicts: list[dict] = []
    for r in rows:
        ms, ans = r["_match"], r["_ans"]
        if ans is None:
            tag = "NO_FIRST"
        elif ans == "题目存疑":
            tag = "SUSPECT"
        elif not ms:
            tag = "UNMATCHED"
        elif all(m[2] for m in ms):
            tag = "MATCH_DISABLED"
        elif ans in {m[1] for m in ms if not m[2]}:
            tag = "OK"
        else:
            tag = "CONFLICT"
            conflicts.append(r)
        r["_tag"] = tag
        stat[tag] += 1
        if verbose:
            print(
                f"{r['key'][:8]} {time.strftime('%m-%d %H:%M', time.gmtime(r['created_at'] + 8 * 3600))} "
                f"{str(r.get('module')):<9} ans={ans!s:<8} hits={r.get('hits')} match={ms[:3]} {tag}"
            )
    print("STAT", stat)
    for r in conflicts:
        print(f"== CONFLICT {r['key'][:8]} first={r['_ans']} qbank={sorted({m[1] for m in r['_match']})} qids={[m[0] for m in r['_match']][:3]}")
    return {"rows": rows, "conflicts": conflicts, "stat": stat, "cols": cols}


def apply(conn: sqlite3.Connection, hit: dict, record: str) -> int:
    cols = hit["cols"]
    deleted = [{c: r[c] for c in cols} for r in hit["conflicts"]]
    with open(record, "w", encoding="utf-8") as f:
        json.dump({"at": time.time(), "cols": cols, "deleted": deleted}, f, ensure_ascii=False)
    for r in deleted:
        conn.execute("DELETE FROM explain_cache WHERE key=?", (r["key"],))
    conn.commit()
    print(f"deleted {len(deleted)} CONFLICT rows → {record}")
    return len(deleted)


def restore(conn: sqlite3.Connection, record: str) -> int:
    with open(record, encoding="utf-8") as f:
        rec = json.load(f)
    cols = [c for c in rec["cols"] if c in _cols(conn)]
    n = 0
    for r in rec["deleted"]:
        if conn.execute("SELECT 1 FROM explain_cache WHERE key=?", (r["key"],)).fetchone():
            continue
        conn.execute(
            f"INSERT INTO explain_cache({','.join(cols)}) VALUES({','.join('?' * len(cols))})",
            [r.get(c) for c in cols],
        )
        n += 1
    conn.commit()
    print(f"restored {n} rows")
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=os.environ.get("DB_PATH", "/data/data.db"))
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--record", default="r423-explain-cache-conflicts.json")
    ap.add_argument("--restore", metavar="FILE")
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()
    conn = sqlite3.connect(a.db, timeout=30)
    try:
        if a.restore:
            restore(conn, a.restore)
            return
        hit = scan(conn, verbose=not a.quiet)
        if not a.apply:
            print("dry-run（加 --apply 只删 CONFLICT 行）")
            return
        apply(conn, hit, a.record)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
