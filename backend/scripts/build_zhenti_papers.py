#!/usr/bin/env python3
"""从题库真题聚合生成成套真题卷（exam_papers）。

按 questions 表的 source/exam_year/exam_region 聚合：同一 source 视为同一套卷，
按行测标准模块顺序（常识→言语→数量→判断→资料）排题，默认 >=60 题才成卷。
卷标题即 source 原文（source 本身就是可读卷名，且对同年同地多卷——如国考地市级/副省级——天然区分）。

只补缺：已有真题卷（psource 命中）的 source 一律跳过，不改动既有卷的 question_ids/标题；
标题已被别的卷占用、题量超过 --max-questions（疑似多卷混装）的 source 也跳过并提示。
幂等：按试卷标题 upsert，可安全重跑。

用法（在仓库根目录或 backend/ 下均可）：
    python backend/scripts/build_zhenti_papers.py --dry-run          # 只打印将生成/跳过的卷清单
    python backend/scripts/build_zhenti_papers.py                    # 实际写入 exam_papers
    python backend/scripts/build_zhenti_papers.py --min-questions 10 # 本地种子库测试用低阈值
    DB_PATH=/path/to/data.db python backend/scripts/build_zhenti_papers.py  # 指定数据库
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import db

MODULE_ORDER = ["changshi", "yanyu", "shuliang", "panduan", "ziliao"]
MOD_NAMES = {"changshi": "常识", "yanyu": "言语", "shuliang": "数量", "panduan": "判断", "ziliao": "资料"}
MAX_QUESTIONS = 140  # 行测单卷上限 135 题；超过即疑似多卷混在一个 source 里


def paper_title(source: str, year, region) -> str:
    title = " ".join((source or "").split())
    if title:
        return title[:80]
    parts = []
    if year:
        parts.append(f"{year}年")
    if region:
        parts.append(str(region))
    parts.append("行测真题卷")
    return "".join(parts)


def duration_for(n: int) -> int:
    """行测整卷 120 分钟；小卷按约 0.9 分/题，向上取 5 的倍数，范围 [30,120]。"""
    if n >= 120:
        return 120
    mins = int(-(-n * 0.9 // 5) * 5)
    return max(30, min(120, mins))


def _source_ids(conn, source: str) -> tuple[list[int], dict[str, int]]:
    """该 source 活跃真题 id 按标准模块顺序排列 + 各模块题数。
    `disabled IS NULL` / `disabled=0` 分两段并显式走 idx_q_paper_src(is_real,disabled,source,…)
    （init_db 建）；OR 写法或无统计信息时规划器只按 is_real 走索引再逐行回宽行表。"""
    rows = conn.execute(
        """SELECT id, module FROM questions INDEXED BY idx_q_paper_src
           WHERE is_real=1 AND disabled IS NULL AND source=?
           UNION ALL
           SELECT id, module FROM questions INDEXED BY idx_q_paper_src
           WHERE is_real=1 AND disabled=0 AND source=?
           ORDER BY id""",
        (source, source),
    ).fetchall()
    by_mod: dict[str, list[int]] = {m: [] for m in MODULE_ORDER}
    by_mod["other"] = []
    for r in rows:
        by_mod.get(r["module"], by_mod["other"]).append(r["id"])
    ids = [i for m in [*MODULE_ORDER, "other"] for i in by_mod[m]]
    return ids, {m: len(v) for m, v in by_mod.items()}


def collect(conn, min_questions: int, max_questions: int = MAX_QUESTIONS):
    """返回 (待建卷, 跳过原因列表)。跳过：已成卷 / 标题被别卷占用 / 题量超上限。"""
    mapped = db._paper_by_psource(conn)
    titles = {r["title"] for r in conn.execute("SELECT title FROM exam_papers")}
    groups = conn.execute(
        """SELECT source, MAX(exam_year) y, MAX(exam_region) rg, COUNT(*) n
           FROM questions
           WHERE is_real=1 AND (disabled IS NULL OR disabled=0)
             AND source IS NOT NULL AND source!=''
           GROUP BY source HAVING n>=? ORDER BY y DESC, n DESC""",
        (min_questions,),
    ).fetchall()
    papers = []
    skipped: list[tuple[str, str]] = []
    for g in groups:
        if g["source"] in mapped:
            skipped.append((g["source"], f"已成卷 id={mapped[g['source']]['pid']}"))
            continue
        if g["n"] > max_questions:
            skipped.append((g["source"], f"{g['n']} 题 > {max_questions}，疑似多卷混装，需人工拆卷"))
            continue
        ids, per_mod = _source_ids(conn, g["source"])
        if len(ids) < min_questions:
            continue
        title = paper_title(g["source"], g["y"], g["rg"])
        if title in titles:
            skipped.append((g["source"], f"标题「{title}」已被别的卷占用"))
            continue
        titles.add(title)
        papers.append({
            "source": g["source"],
            "title": title,
            "year": g["y"],
            "region": g["rg"],
            "ids": ids,
            "per_mod": per_mod,
            "duration": duration_for(len(ids)),
        })
    return papers, skipped


def main():
    ap = argparse.ArgumentParser(description="从真题聚合生成成套真题卷（exam_papers）")
    ap.add_argument("--min-questions", type=int, default=60, help="成卷最低题量（默认 60；本地种子库可调低）")
    ap.add_argument("--max-questions", type=int, default=MAX_QUESTIONS,
                    help=f"单卷题量上限（默认 {MAX_QUESTIONS}；超过视为多卷混装跳过）")
    ap.add_argument("--dry-run", action="store_true", help="只打印将生成的卷清单，不写库")
    args = ap.parse_args()

    print(f"数据库：{os.path.abspath(db.DB_PATH)}")
    db.init_db()
    conn = db.get_conn()
    papers, skipped = collect(conn, args.min_questions, args.max_questions)
    conn.close()

    for src, why in skipped:
        print(f"  跳过 {src} | {why}")
    if not papers:
        print(f"没有满足 >={args.min_questions} 题且尚未成卷的真题分组，未生成任何卷。")
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
