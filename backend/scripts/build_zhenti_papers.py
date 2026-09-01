#!/usr/bin/env python3
"""从题库真题聚合生成成套真题卷（exam_papers）。

按 questions 表的 source/exam_year/exam_region 聚合：同一 source 视为同一套卷，
按行测标准模块顺序（常识→言语→数量→判断→资料）排题，默认 >=60 题才成卷。
幂等：按试卷标题 upsert，可安全重跑。

用法（在仓库根目录或 backend/ 下均可）：
    python backend/scripts/build_zhenti_papers.py --dry-run          # 只打印将生成的卷清单
    python backend/scripts/build_zhenti_papers.py                    # 实际写入 exam_papers
    python backend/scripts/build_zhenti_papers.py --min-questions 10 # 本地种子库测试用低阈值
    DB_PATH=/path/to/data.db python backend/scripts/build_zhenti_papers.py  # 指定数据库
"""
import argparse
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import db

MODULE_ORDER = ["changshi", "yanyu", "shuliang", "panduan", "ziliao"]
MOD_NAMES = {"changshi": "常识", "yanyu": "言语", "shuliang": "数量", "panduan": "判断", "ziliao": "资料"}
_TITLE_RE = re.compile(r"(\d{4}年[^（(）).]{2,40}《行测》(?:真题|试卷|试题)?(?:（[^）]{1,8}）)?)")


def paper_title(source: str, year, region) -> str:
    m = _TITLE_RE.search(source or "")
    if m:
        return m.group(1)
    parts = []
    if year:
        parts.append(f"{year}年")
    if region:
        parts.append(str(region))
    parts.append("行测真题卷")
    title = "".join(parts)
    if not year and not region:
        title = (source or "未命名")[:36] + " 真题卷"
    return title


def duration_for(n: int) -> int:
    """行测整卷 120 分钟；小卷按约 0.9 分/题，向上取 5 的倍数，范围 [30,120]。"""
    if n >= 120:
        return 120
    mins = int(-(-n * 0.9 // 5) * 5)
    return max(30, min(120, mins))


def collect(conn, min_questions: int):
    groups = conn.execute(
        """SELECT source, MAX(exam_year) y, MAX(exam_region) rg, COUNT(*) n
           FROM questions
           WHERE is_real=1 AND (disabled IS NULL OR disabled=0)
             AND source IS NOT NULL AND source!=''
           GROUP BY source HAVING n>=? ORDER BY y DESC, n DESC""",
        (min_questions,),
    ).fetchall()
    papers = []
    for g in groups:
        ids = []
        per_mod = {}
        for mod in MODULE_ORDER:
            rows = conn.execute(
                """SELECT id FROM questions
                   WHERE source=? AND is_real=1 AND (disabled IS NULL OR disabled=0) AND module=?
                   ORDER BY id""",
                (g["source"], mod),
            ).fetchall()
            per_mod[mod] = len(rows)
            ids += [r["id"] for r in rows]
        rest = conn.execute(
            """SELECT id FROM questions
               WHERE source=? AND is_real=1 AND (disabled IS NULL OR disabled=0)
                 AND (module IS NULL OR module NOT IN (?,?,?,?,?))
               ORDER BY id""",
            (g["source"], *MODULE_ORDER),
        ).fetchall()
        per_mod["other"] = len(rest)
        ids += [r["id"] for r in rest]
        if len(ids) < min_questions:
            continue
        papers.append({
            "source": g["source"],
            "title": paper_title(g["source"], g["y"], g["rg"]),
            "year": g["y"],
            "region": g["rg"],
            "ids": ids,
            "per_mod": per_mod,
            "duration": duration_for(len(ids)),
        })
    return papers


def main():
    ap = argparse.ArgumentParser(description="从真题聚合生成成套真题卷（exam_papers）")
    ap.add_argument("--min-questions", type=int, default=60, help="成卷最低题量（默认 60；本地种子库可调低）")
    ap.add_argument("--dry-run", action="store_true", help="只打印将生成的卷清单，不写库")
    args = ap.parse_args()

    print(f"数据库：{os.path.abspath(db.DB_PATH)}")
    db.init_db()
    conn = db.get_conn()
    papers = collect(conn, args.min_questions)
    conn.close()

    if not papers:
        print(f"没有满足 >={args.min_questions} 题的真题分组，未生成任何卷。")
        return

    for p in papers:
        mods = " ".join(f"{MOD_NAMES.get(m, m)}{c}" for m, c in p["per_mod"].items() if c)
        print(f"- {p['title']} | {p['year'] or '-'} {p['region'] or '-'} | "
              f"{len(p['ids'])} 题 / {p['duration']} 分钟 | {mods}")

    if args.dry_run:
        print(f"\n[dry-run] 共 {len(papers)} 套，未写入数据库。")
        return

    for p in papers:
        pid = db.upsert_exam_paper(p["title"], "zhenti", p["year"], p["region"], p["ids"], p["duration"])
        print(f"  写入 exam_papers id={pid}: {p['title']}")
    print(f"\n完成：共 {len(papers)} 套真题卷（幂等 upsert，可重复执行）。")


if __name__ == "__main__":
    main()
