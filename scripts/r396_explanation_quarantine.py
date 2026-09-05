#!/usr/bin/env python3
"""r396 解析串题隔离：把人工确认「解析属于另一道题」的整块题目的 explanation 移入 explanation_quarantine 表，
questions.explanation 置空（前端/SEO/错题快照自动回落到 hs_explanation），可整体 --restore 还原。

模式：
  --scan                       全库 is_real 题按 id 聚块，打印低贴合连续块（quality.misaligned_blocks），只读
  --blocks lo-hi[,lo-hi...]    对指定块做隔离（默认 dry-run 打印逐行贴合度；--apply 才写库）
      --keep id[,id]           块内人工核对为正确的题，跳过
      --extra id[,id]          块外/贴合度偏高但人工核对为串题的题，一并隔离
      --fit-max F              块内只隔离贴合度 < F 的行（默认 0.08；无贴合度值的行照常隔离）
  --restore                    把 explanation_quarantine 里的解析写回 questions.explanation（仅当前值仍为空）

写库时同步：mistakes.explanation 快照若与被隔离解析相同，改为该题 hs_explanation（错题本展开卡直读快照）。
本地：DB_PATH=/path/data.db python3 scripts/r396_explanation_quarantine.py --scan
生产：sudo docker exec -i deploy-kaogong-1 python3 - --blocks 264413-264477 --keep 264413,264420 [--apply] < scripts/r396_explanation_quarantine.py
"""
import argparse
import os
import sqlite3
import sys
import time

try:
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
except NameError:  # 经 stdin 管道运行（容器内 cwd=/app/backend 可直接 import app）
    pass

from app import quality

DEFAULT_FIT_MAX = 0.08
REASON = "r396:cross-question-explanation"

DDL = """CREATE TABLE IF NOT EXISTS explanation_quarantine (
    question_id INTEGER PRIMARY KEY,
    explanation TEXT NOT NULL,
    fit REAL,
    block TEXT,
    reason TEXT,
    created_at REAL
)"""


def parse_ids(s: str | None) -> set[int]:
    return {int(x) for x in (s or "").split(",") if x.strip()}


def parse_blocks(s: str | None) -> list[tuple[int, int]]:
    out = []
    for part in (s or "").split(","):
        if not part.strip():
            continue
        lo, hi = part.split("-")
        out.append((int(lo), int(hi)))
    return out


def scan(conn) -> None:
    rows = [dict(r) for r in conn.execute(
        "SELECT id, question, options, explanation FROM questions WHERE is_real=1 ORDER BY id"
    )]
    blocks = quality.misaligned_blocks(rows)
    print(f"scanned {len(rows)} real rows -> {len(blocks)} suspect blocks")
    for b in blocks:
        act = conn.execute(
            "SELECT COUNT(*), SUM(disabled=0) FROM questions WHERE id BETWEEN ? AND ?", (b["lo"], b["hi"])
        ).fetchone()
        src = conn.execute(
            "SELECT source FROM questions WHERE id BETWEEN ? AND ? GROUP BY source ORDER BY COUNT(*) DESC LIMIT 1",
            (b["lo"], b["hi"]),
        ).fetchone()
        print(f"  {b['lo']}-{b['hi']} scored={b['rows']} low={b['low']} ratio={b['ratio']} "
              f"rows={act[0]} active={act[1] or 0} source={src[0] if src else None}")


def select_targets(conn, blocks, keep: set[int], extra: set[int], fit_max: float) -> list[dict]:
    targets: list[dict] = []
    for lo, hi in blocks:
        for r in conn.execute(
            "SELECT id, disabled, question, options, explanation, hs_explanation FROM questions "
            "WHERE id BETWEEN ? AND ? AND explanation IS NOT NULL AND explanation!='' ORDER BY id",
            (lo, hi),
        ):
            d = dict(r)
            d["fit"] = quality.explanation_fit(d)
            d["block"] = f"{lo}-{hi}"
            if d["id"] in keep:
                d["skip"] = "keep"
            elif d["fit"] is not None and d["fit"] >= fit_max and d["id"] not in extra:
                d["skip"] = f"fit>={fit_max}"
            else:
                d["skip"] = None
            targets.append(d)
    seen = {t["id"] for t in targets}
    for qid in sorted(extra - seen):
        r = conn.execute(
            "SELECT id, disabled, question, options, explanation, hs_explanation FROM questions WHERE id=?", (qid,)
        ).fetchone()
        if r and (r["explanation"] or ""):
            d = dict(r)
            d["fit"] = quality.explanation_fit(d)
            d["block"] = "extra"
            d["skip"] = None
            targets.append(d)
    return targets


def report(targets: list[dict]) -> None:
    for t in targets:
        f = "  --" if t["fit"] is None else f"{t['fit']:.2f}"
        flag = f"skip({t['skip']})" if t["skip"] else ("QUARANTINE" + ("" if t["disabled"] == 0 else " (disabled)"))
        print(f"  {t['id']} fit={f} hs={'y' if t['hs_explanation'] else 'n'} {flag}")
        if not t["skip"] or t["disabled"] == 0:
            print(f"      Q: {(t['question'] or '')[:60]!r}")
            print(f"      E: {(t['explanation'] or '')[:70]!r}")
    go = [t for t in targets if not t["skip"]]
    act = [t for t in go if t["disabled"] == 0]
    print(f"targets: {len(go)} (active {len(act)}, active without hs {sum(1 for t in act if not t['hs_explanation'])}); "
          f"skipped: {len(targets) - len(go)}")


def apply(conn, targets: list[dict]) -> None:
    now = time.time()
    conn.execute(DDL)
    n_mist = 0
    for t in targets:
        if t["skip"]:
            continue
        conn.execute(
            "INSERT OR IGNORE INTO explanation_quarantine (question_id, explanation, fit, block, reason, created_at) "
            "VALUES (?,?,?,?,?,?)",
            (t["id"], t["explanation"], t["fit"], t["block"], REASON, now),
        )
        conn.execute("UPDATE questions SET explanation=NULL, updated_at=? WHERE id=?", (now, t["id"]))
        cur = conn.execute(
            "UPDATE mistakes SET explanation=? WHERE question_id=? AND explanation=?",
            (t["hs_explanation"] or "", t["id"], t["explanation"]),
        )
        n_mist += cur.rowcount
    conn.commit()
    print(f"applied: quarantined {sum(1 for t in targets if not t['skip'])}, mistakes snapshots rewritten {n_mist}")


def restore(conn) -> None:
    rows = conn.execute("SELECT question_id, explanation FROM explanation_quarantine").fetchall()
    n = 0
    for r in rows:
        cur = conn.execute(
            "UPDATE questions SET explanation=?, updated_at=? WHERE id=? AND (explanation IS NULL OR explanation='')",
            (r["explanation"], time.time(), r["question_id"]),
        )
        n += cur.rowcount
    conn.execute("DELETE FROM explanation_quarantine")
    conn.commit()
    print(f"restored {n}/{len(rows)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=os.environ.get("DB_PATH", "/data/data.db"))
    ap.add_argument("--scan", action="store_true")
    ap.add_argument("--blocks")
    ap.add_argument("--keep")
    ap.add_argument("--extra")
    ap.add_argument("--fit-max", type=float, default=DEFAULT_FIT_MAX)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--restore", action="store_true")
    args = ap.parse_args()
    write = args.apply or args.restore
    conn = sqlite3.connect(args.db if write else f"file:{args.db}?mode=ro", uri=not write, timeout=30)
    conn.row_factory = sqlite3.Row
    if args.restore:
        restore(conn)
    elif args.scan:
        scan(conn)
    elif args.blocks or args.extra:
        targets = select_targets(conn, parse_blocks(args.blocks), parse_ids(args.keep), parse_ids(args.extra), args.fit_max)
        report(targets)
        if args.apply:
            apply(conn, targets)
        else:
            print("dry-run only; pass --apply to write")
    else:
        ap.error("need one of --scan / --blocks / --extra / --restore")
    conn.close()


if __name__ == "__main__":
    main()
