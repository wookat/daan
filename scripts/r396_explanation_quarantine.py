#!/usr/bin/env python3
"""r396 解析串题隔离：把人工确认「解析属于另一道题」的整块题目的 explanation 移入 explanation_quarantine 表，
questions.explanation 置空（前端/SEO/错题快照自动回落到 hs_explanation），可整体 --restore 还原。

模式：
  --scan                       全库 is_real 题按 id 聚块，打印低贴合连续块（quality.misaligned_blocks），只读
  --blocks lo-hi[,lo-hi...]    对指定块做隔离（默认 dry-run 打印逐行贴合度；--apply 才写库）
      --keep id[,id]           块内人工核对为正确的题，跳过
      --extra id[,id]          块外/贴合度偏高但人工核对为串题的题，一并隔离
      --fit-max F              块内只隔离贴合度 < F 的行（默认 0.08；无贴合度值的行照常隔离）
  --restore [--reason R]       把 explanation_quarantine 里的解析写回 questions.explanation（仅当前值仍为空）；--reason 只还原该原因的行
  --garbled                    r400 公式丢失骨架解析（quality.formula_dropped；--keep/--extra/--apply 同上，reason=r400）
  --strip-footers              r400 PDF 页脚串进 explanation/options（quality.strip_page_footers），原文存 text_footer_fix 表；--apply 才写
  --restore-footers            把 text_footer_fix 里的原文写回（仅当前值仍等于修后值）

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
REASON_GARBLED = "r400:formula-dropped-explanation"

DDL = """CREATE TABLE IF NOT EXISTS explanation_quarantine (
    question_id INTEGER PRIMARY KEY,
    explanation TEXT NOT NULL,
    fit REAL,
    block TEXT,
    reason TEXT,
    created_at REAL
)"""

DDL_FOOTER = """CREATE TABLE IF NOT EXISTS text_footer_fix (
    question_id INTEGER NOT NULL,
    field TEXT NOT NULL,
    before TEXT NOT NULL,
    after TEXT NOT NULL,
    created_at REAL,
    PRIMARY KEY (question_id, field)
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


def select_garbled(conn, keep: set[int], extra: set[int]) -> list[dict]:
    """公式丢失骨架解析：全库 is_real 逐行过 quality.formula_dropped；extra 为人工核定的块外行。"""
    targets: list[dict] = []
    for r in conn.execute(
        "SELECT id, disabled, module, question, options, explanation, hs_explanation FROM questions "
        "WHERE is_real=1 AND explanation IS NOT NULL AND explanation!='' ORDER BY id"
    ):
        d = dict(r)
        sig = quality.formula_dropped(d)
        if sig is None and d["id"] not in extra:
            continue
        d["fit"] = quality.explanation_fit(d)
        d["block"] = f"garbled:{sig or 'extra'}"
        d["skip"] = "keep" if d["id"] in keep else None
        targets.append(d)
    return targets


def select_footers(conn) -> list[dict]:
    """explanation/options 里串进 PDF 页脚的行，返回 [{id, field, before, after}]。"""
    out: list[dict] = []
    for r in conn.execute(
        "SELECT id, explanation, options FROM questions WHERE is_real=1 "
        "AND (explanation LIKE '%页共%页%' OR explanation LIKE '%真题%' OR options LIKE '%真题%' OR options LIKE '%页共%页%') ORDER BY id"
    ):
        for field in ("explanation", "options"):
            before = r[field] or ""
            after = quality.strip_page_footers(before)
            if after != before:
                out.append({"id": r["id"], "field": field, "before": before, "after": after})
    return out


def report_footers(rows: list[dict]) -> None:
    for x in rows:
        m = quality.FOOTER_PAGE_RE.search(x["before"]) or quality.FOOTER_SRC_RE.search(x["before"])
        print(f"  {x['id']} {x['field']} cut={m.group(0).strip() if m else '?'!r} -{len(x['before']) - len(x['after'])} chars")
    print(f"footer fixes: {len(rows)} ({sum(1 for x in rows if x['field'] == 'options')} options)")


def apply_footers(conn, rows: list[dict]) -> None:
    now = time.time()
    conn.execute(DDL_FOOTER)
    n = 0
    for x in rows:
        conn.execute(
            "INSERT OR IGNORE INTO text_footer_fix (question_id, field, before, after, created_at) VALUES (?,?,?,?,?)",
            (x["id"], x["field"], x["before"], x["after"], now),
        )
        cur = conn.execute(
            f"UPDATE questions SET {x['field']}=?, updated_at=? WHERE id=? AND {x['field']}=?",
            (x["after"], now, x["id"], x["before"]),
        )
        n += cur.rowcount
    conn.commit()
    print(f"applied: footer fixes {n}/{len(rows)}")


def restore_footers(conn) -> None:
    rows = conn.execute("SELECT question_id, field, before, after FROM text_footer_fix").fetchall()
    n = 0
    for r in rows:
        if r["field"] not in ("explanation", "options"):
            continue
        cur = conn.execute(
            f"UPDATE questions SET {r['field']}=?, updated_at=? WHERE id=? AND {r['field']}=?",
            (r["before"], time.time(), r["question_id"], r["after"]),
        )
        n += cur.rowcount
    conn.execute("DELETE FROM text_footer_fix")
    conn.commit()
    print(f"restored footers {n}/{len(rows)}")


def report(targets: list[dict]) -> None:
    for t in targets:
        f = "  --" if t["fit"] is None else f"{t['fit']:.2f}"
        flag = f"skip({t['skip']})" if t["skip"] else ("QUARANTINE" + ("" if t["disabled"] == 0 else " (disabled)"))
        print(f"  {t['id']} fit={f} hs={'y' if t['hs_explanation'] else 'n'} {t['block']} {flag}")
        if not t["skip"] or t["disabled"] == 0:
            print(f"      Q: {(t['question'] or '')[:60]!r}")
            print(f"      E: {(t['explanation'] or '')[:70]!r}")
    go = [t for t in targets if not t["skip"]]
    act = [t for t in go if t["disabled"] == 0]
    print(f"targets: {len(go)} (active {len(act)}, active without hs {sum(1 for t in act if not t['hs_explanation'])}); "
          f"skipped: {len(targets) - len(go)}")


def _no_ws(expr: str) -> str:
    return f"replace(replace(replace({expr},' ',''),'　',''),char(10),'')"


def apply(conn, targets: list[dict], reason: str = REASON) -> None:
    now = time.time()
    conn.execute(DDL)
    n_mist = n_q = 0
    changed: list[int] = []
    for t in targets:
        if t["skip"]:
            continue
        # 只在 base 仍等于扫描时的文本才隔离；被并发写入者改过的行跳过并报出，避免快照过期
        cur = conn.execute(
            "UPDATE questions SET explanation=NULL, updated_at=? WHERE id=? AND explanation=?",
            (now, t["id"], t["explanation"]),
        )
        if cur.rowcount != 1:
            changed.append(t["id"])
            continue
        n_q += 1
        conn.execute(
            "INSERT OR IGNORE INTO explanation_quarantine (question_id, explanation, fit, block, reason, created_at) "
            "VALUES (?,?,?,?,?,?)",
            (t["id"], t["explanation"], t["fit"], t["block"], reason, now),
        )
        # 快照与被隔离解析只差空白（清洗脚本归一空白前写入）也算同一文本
        cur = conn.execute(
            "UPDATE mistakes SET explanation=? WHERE question_id=? AND " + _no_ws("explanation") + "=" + _no_ws("?"),
            (t["hs_explanation"] or "", t["id"], t["explanation"]),
        )
        n_mist += cur.rowcount
    conn.commit()
    print(f"applied: quarantined {n_q}, mistakes snapshots rewritten {n_mist}")
    if changed:
        print(f"skipped (explanation changed concurrently since scan): {changed}")


def restore(conn, reason: str | None = None) -> None:
    where, args = (" WHERE reason=?", (reason,)) if reason else ("", ())
    rows = conn.execute(f"SELECT question_id, explanation FROM explanation_quarantine{where}", args).fetchall()
    n = 0
    for r in rows:
        cur = conn.execute(
            "UPDATE questions SET explanation=?, updated_at=? WHERE id=? AND (explanation IS NULL OR explanation='')",
            (r["explanation"], time.time(), r["question_id"]),
        )
        n += cur.rowcount
    conn.execute(f"DELETE FROM explanation_quarantine{where}", args)
    conn.commit()
    print(f"restored {n}/{len(rows)}" + (f" (reason={reason})" if reason else ""))


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
    ap.add_argument("--reason")
    ap.add_argument("--garbled", action="store_true")
    ap.add_argument("--strip-footers", action="store_true")
    ap.add_argument("--restore-footers", action="store_true")
    args = ap.parse_args()
    write = args.apply or args.restore or args.restore_footers
    conn = sqlite3.connect(args.db if write else f"file:{args.db}?mode=ro", uri=not write, timeout=30)
    conn.row_factory = sqlite3.Row
    if args.restore:
        restore(conn, args.reason)
    elif args.restore_footers:
        restore_footers(conn)
    elif args.scan:
        scan(conn)
    elif args.garbled:
        targets = select_garbled(conn, parse_ids(args.keep), parse_ids(args.extra))
        report(targets)
        if args.apply:
            apply(conn, targets, args.reason or REASON_GARBLED)
        else:
            print("dry-run only; pass --apply to write")
    elif args.strip_footers:
        rows = select_footers(conn)
        report_footers(rows)
        if args.apply:
            apply_footers(conn, rows)
        else:
            print("dry-run only; pass --apply to write")
    elif args.blocks or args.extra:
        targets = select_targets(conn, parse_blocks(args.blocks), parse_ids(args.keep), parse_ids(args.extra), args.fit_max)
        report(targets)
        if args.apply:
            apply(conn, targets)
        else:
            print("dry-run only; pass --apply to write")
    else:
        ap.error("need one of --scan / --blocks / --extra / --garbled / --strip-footers / --restore / --restore-footers")
    conn.close()


if __name__ == "__main__":
    main()
