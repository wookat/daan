#!/usr/bin/env python3
"""真题卷库元数据修复与存量缺题回挂排查脚本（幂等）。

功能：
1. 修复国考卷 region 为空/NULL 的分裂问题（统一设为 '国考'）；
2. 盘点所有不完整真题卷（n < 100 或缺任一行测五模块）与 >160 题混装合卷；
3. 检查 questions 表中是否存在同 source（is_real=1 AND disabled=0）但尚未挂入卷内 question_ids
   的存量真题（尤其是资料分析/图推题），--apply --reattach 可按标准模块序幂等补挂。

用法：
    python backend/scripts/fix_zhenti_metadata.py --plan
    python backend/scripts/fix_zhenti_metadata.py --apply
    python backend/scripts/fix_zhenti_metadata.py --apply --reattach
"""
import argparse
import json
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import db


def audit_and_fix(apply: bool = False, reattach: bool = False) -> dict:
    db.init_db()
    conn = db.get_conn()
    has_table = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='exam_papers'"
    ).fetchone()
    if not has_table:
        if not apply:
            conn.close()
            return {
                "total_zhenti": 0, "untagged_guokao": 0, "incomplete_count": 0,
                "merged_count": 0, "reattach_candidates": 0,
                "reattached_papers": 0, "reattached_questions": 0,
                "sample_reattach": [], "merged_papers": [],
            }
        db._ensure_exam_tables(conn)

    # 1. 国考 region 分裂排查/回填（--plan 严格只读，不在统计前触发自动回填）
    untagged_guokao = conn.execute(
        "SELECT id, title, year FROM exam_papers "
        "WHERE (region IS NULL OR region='') AND (title LIKE '%国考%' OR title LIKE '%国家%')"
    ).fetchall()
    if apply and untagged_guokao:
        conn.execute(
            "UPDATE exam_papers SET region='国考' "
            "WHERE (region IS NULL OR region='') AND (title LIKE '%国考%' OR title LIKE '%国家%')"
        )
        conn.commit()
        db._papers_cache.clear()

    # 2. 盘点全部 zhenti 卷的完整度、缺失模块与可回挂存量题
    papers = conn.execute(
        "SELECT id, title, year, region, question_ids FROM exam_papers WHERE kind='zhenti' ORDER BY year DESC, id DESC"
    ).fetchall()
    mod_rank = {m: i for i, m in enumerate(db.MODULE_ORDER)}

    incomplete = []
    merged = []
    reattach_plan = []
    reattached_papers = 0
    reattached_qs = 0

    for p in papers:
        qids = json.loads(p["question_ids"] or "[]")
        if not qids:
            incomplete.append({"id": p["id"], "title": p["title"], "n": 0, "missing": list(db.MODULE_ORDER)})
            continue
        qrows = conn.execute(
            f"SELECT id, module, source FROM questions WHERE disabled=0 AND id IN ({','.join('?' * len(qids))})",
            qids,
        ).fetchall()
        active_set = {r["id"] for r in qrows}
        active_qids = [i for i in qids if i in active_set]
        mod_cnt = Counter(r["module"] for r in qrows if r["module"] in mod_rank)
        missing = [m for m in db.MODULE_ORDER if mod_cnt.get(m, 0) == 0]
        n = len(active_qids)
        if n > 160:
            merged.append({"id": p["id"], "title": p["title"], "n": n, "mods": dict(mod_cnt)})
        if n < 100 or missing:
            incomplete.append({"id": p["id"], "title": p["title"], "n": n, "missing": missing, "mods": dict(mod_cnt)})
            # 同主导 source 下查找未挂载的活跃真题
            src_cnt = Counter(r["source"] for r in qrows if r["source"])
            if src_cnt:
                dom_src, dom_n = src_cnt.most_common(1)[0]
                if dom_n >= 20:
                    extras = conn.execute(
                        "SELECT id, module FROM questions WHERE is_real=1 AND disabled=0 AND source=? ORDER BY id",
                        (dom_src,),
                    ).fetchall()
                    extra_rows = [r for r in extras if r["id"] not in active_set and r["module"] in mod_rank]
                    if extra_rows and n + len(extra_rows) <= 155:
                        reattach_plan.append({
                            "id": p["id"],
                            "title": p["title"],
                            "before": n,
                            "add": len(extra_rows),
                            "add_mods": dict(Counter(r["module"] for r in extra_rows)),
                        })
                        if apply and reattach:
                            by_id_mod = {r["id"]: r["module"] for r in qrows}
                            for r in extra_rows:
                                by_id_mod[r["id"]] = r["module"]
                            combined = active_qids + [r["id"] for r in extra_rows]
                            combined.sort(key=lambda qid: (mod_rank.get(by_id_mod.get(qid, ""), 99), qid))
                            conn.execute(
                                "UPDATE exam_papers SET question_ids=? WHERE id=?",
                                (json.dumps(combined), p["id"]),
                            )
                            reattached_papers += 1
                            reattached_qs += len(extra_rows)

    if apply and reattach and reattached_papers:
        conn.commit()
        db._papers_cache.clear()
    conn.close()

    return {
        "total_zhenti": len(papers),
        "untagged_guokao": len(untagged_guokao),
        "incomplete_count": len(incomplete),
        "merged_count": len(merged),
        "reattach_candidates": len(reattach_plan),
        "reattached_papers": reattached_papers,
        "reattached_questions": reattached_qs,
        "sample_reattach": reattach_plan[:15],
        "merged_papers": merged[:10],
    }


def main():
    ap = argparse.ArgumentParser(description="真题卷库元数据修复与存量补挂排查")
    ap.add_argument("--plan", action="store_true", help="只读排查并输出报告")
    ap.add_argument("--apply", action="store_true", help="写入修复（默认修复国考 region）")
    ap.add_argument("--reattach", action="store_true", help="配合 --apply 回挂同 source 存量漏挂真题")
    args = ap.parse_args()
    res = audit_and_fix(apply=args.apply, reattach=args.reattach)
    print(json.dumps(res, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
