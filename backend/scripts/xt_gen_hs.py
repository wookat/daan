#!/usr/bin/env python3
"""给真题卷缺 hs_explanation 的题批量生成花生十三解析。

复用 services/engine.py 的提示词与方法库（与 AI 问答同款讲解），
产出走 db.import_hs_explanations（内含 sanitize + rescore）。

范围：kind='zhenti' 卷内活跃题、无 hs_explanation、非纯图题（纯文本可解）。
带图题跳过（需视觉抽取链路，另走 extract_question）。

断点续跑：已生成 has_hs=1 自动跳过；Ctrl-C/容器重启后重跑即可。

用法（容器内后台）：
    nohup python scripts/xt_gen_hs.py --workers 6 >> /data/xt_gen_hs.log 2>&1 &
"""
import argparse
import asyncio
import json
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import db
from app.db.seed import import_hs_explanations
from app.services import engine

BATCH = 40


def target_qids(conn) -> list[int]:
    qids: set[int] = set()
    for r in conn.execute("SELECT question_ids FROM exam_papers WHERE kind='zhenti'"):
        qids.update(json.loads(r["question_ids"] or "[]"))
    return sorted(qids)


def fetch_batch(conn, ids):
    qs = []
    for qid in ids:
        r = conn.execute(
            """SELECT id, question, options, answer, module, submodule, image, disabled, has_hs
                 FROM questions WHERE id=?""", (qid,)
        ).fetchone()
        if not r or r["disabled"] or r["has_hs"] or r["image"]:
            continue  # 已删/已有/带图(需视觉) 一律跳过
        opts = json.loads(r["options"] or "{}")
        if not any(str(v).strip() for v in opts.values()):
            continue  # 纯图选项不可文本讲解
        opt_txt = "\n".join(f"{k}. {v}" for k, v in opts.items() if str(v).strip())
        qs.append({
            "id": r["id"],
            "question_text": f"{r['question']}\n{opt_txt}",
            "module": r["module"], "question_type": r["submodule"] or "",
            "known_answer": r["answer"],
        })
    return qs


async def worker(sem: asyncio.Semaphore, q: dict, results: list):
    async with sem:
        try:
            text = await engine.explain(q)
            if text and "题目存疑" not in text[:60]:
                results.append({"id": q["id"], "hs_explanation": text})
        except Exception as e:  # noqa: BLE001 批量生成容错，失败题跳过
            print(f"[gen] q{q['id']} err: {e}", file=sys.stderr)


async def main_async(workers: int):
    db.init_db()
    conn = db.get_conn()
    ids = target_qids(conn)
    todo = fetch_batch(conn, ids)
    conn.close()
    total = len(todo)
    print(f"[gen] 待生成 {total} 题（卷内去重 {len(ids)}）", flush=True)
    sem = asyncio.Semaphore(workers)
    done = 0
    for i in range(0, total, BATCH):
        chunk = todo[i:i + BATCH]
        results: list = []
        await asyncio.gather(*[worker(sem, q, results) for q in chunk])
        if results:
            import_hs_explanations(results)
        done += len(chunk)
        print(f"[gen] {done}/{total} (+{len(results)})", flush=True)
    print("[gen] done", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()
    t0 = time.time()
    asyncio.run(main_async(args.workers))
    print(f"[gen] 耗时 {time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
