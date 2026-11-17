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
import re
import sys
import time

# 全部走主模型（grok-4.7）：429/5xx 退避重试，不降级 rescue；
# grok 思考型模型 + 长讲解输出常超默认 180s 读超时，放宽到 360s
os.environ.setdefault("LLM_MAIN_ONLY", "1")
os.environ.setdefault("LLM_TIMEOUT", "300")

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


def _accept(q: dict, text: str | None) -> str | None:
    """质量闸：占位符未填/答案与已知答案不符/题目存疑 → 拒收。"""
    if not text or "题目存疑" in text[:60]:
        return None
    if "【一句话】核心思路" in text:
        return None
    m = re.search(r"【答案】([A-E]+)", text)
    norm = lambda s: "".join(sorted((s or "").upper()))
    if m and q["known_answer"] and norm(m.group(1)) != norm(q["known_answer"].strip()):
        print(f"[gen] q{q['id']} 答案不符 model={m.group(1)} truth={q['known_answer']}", file=sys.stderr)
        return None
    return text


async def worker(sem: asyncio.Semaphore, q: dict, results: list):
    async with sem:
        t0 = time.time()
        try:
            # 中转站有"挂起不回"模式（TCP 保持连接但永不完成）——httpx 读超时可能被
            # 心跳字节不断重置，必须外层硬截止兜底
            text = _accept(q, await asyncio.wait_for(engine.explain(q), timeout=420))
            if text:
                results.append({"id": q["id"], "hs_explanation": text})
        except Exception as e:  # noqa: BLE001 批量生成容错，失败题跳过
            print(f"[gen] q{q['id']} err: {type(e).__name__} {e!r}", file=sys.stderr)
        print(f"[gen] q{q['id']} done in {time.time()-t0:.0f}s", flush=True)


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
