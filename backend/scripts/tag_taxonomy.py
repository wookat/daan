"""LLM 三级考点打标管线。

批量取 tag3 为空的题目，按题干+选项+解析在该题 submodule 对应的候选考点清单内
判定三级考点 code（只允许清单内 code 或 UNKNOWN），写回 questions.tag3；
低置信（confidence < 0.6）或 UNKNOWN 的写入 tag3_review 供抽审。

用法（在仓库根目录、与生产同样的 LLM 环境变量下运行）：
    python -m backend.scripts.tag_taxonomy --limit 200            # 打标 200 题
    python -m backend.scripts.tag_taxonomy --module ziliao        # 只打某模块
    python -m backend.scripts.tag_taxonomy --dry-run --limit 20   # 只打印不写库
    python -m backend.scripts.tag_taxonomy                        # 全量（断点续跑，可反复执行）

限速：--concurrency 控制并发（默认 3），--sleep 每题间隔秒数（默认 0.2）。
断点续跑：只挑 tag3 IS NULL 的题，随时中断后重跑即可继续。
"""
import argparse
import asyncio
import json
import sys
import time

sys.path.insert(0, ".")

from backend.app import db, llm, taxonomy

CONF_THRESHOLD = 0.6

PROMPT = """你是行测教研专家。请判断下面这道题属于哪个三级考点。

题目模块：{module_name}（二级题型：{submodule}）
题干：{question}
选项：{options}
解析：{explanation}

候选考点清单（只能从中选择）：
{candidates}

要求：
1. 只能输出清单内的 code；如果都不合适或无法判断，输出 UNKNOWN。
2. 严格输出 JSON：{{"code": "...", "confidence": 0.0到1.0, "reason": "一句话理由"}}
"""


def fetch_untagged(module: str | None, limit: int) -> list[dict]:
    conn = db.get_conn()
    where = "tag3 IS NULL AND (disabled IS NULL OR disabled=0)"
    args: list = []
    if module:
        where += " AND module=?"
        args.append(module)
    rows = conn.execute(
        f"SELECT id, module, submodule, question, options, explanation FROM questions "
        f"WHERE {where} ORDER BY id LIMIT ?",
        (*args, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def write_tag(qid: int, code: str):
    conn = db.get_conn()
    conn.execute("UPDATE questions SET tag3=? WHERE id=?", (code, qid))
    conn.commit()
    conn.close()


async def tag_one(q: dict, dry_run: bool) -> dict:
    cands = taxonomy.candidate_topics(q["module"], q.get("submodule"))
    if not cands:
        return {"id": q["id"], "code": "UNKNOWN", "confidence": 0.0, "reason": "无候选考点", "review": True}
    cand_lines = "\n".join(f"- {t['code']} {t['name']}：{t.get('desc','')}" for t in cands)
    try:
        opts = json.loads(q.get("options") or "{}")
    except (json.JSONDecodeError, TypeError):
        opts = {}
    prompt = PROMPT.format(
        module_name=q["module"],
        submodule=q.get("submodule") or "未知",
        question=(q.get("question") or "")[:1500],
        options=json.dumps(opts, ensure_ascii=False)[:800],
        explanation=(q.get("explanation") or "")[:1200],
        candidates=cand_lines,
    )
    valid = {t["code"] for t in cands}
    last_err = None
    for attempt in range(3):
        try:
            d = await llm.chat_json([{"role": "user", "content": prompt}], fast=True, max_tokens=300)
            code = str(d.get("code", "")).strip()
            conf = float(d.get("confidence", 0) or 0)
            reason = str(d.get("reason", ""))[:200]
            if code not in valid:
                code = "UNKNOWN"
            review = code == "UNKNOWN" or conf < CONF_THRESHOLD
            if not dry_run:
                write_tag(q["id"], code)
                if review:
                    db.tag3_review_add(q["id"], code, conf, reason)
            return {"id": q["id"], "code": code, "confidence": conf, "reason": reason, "review": review}
        except Exception as e:
            last_err = e
            await asyncio.sleep(2 * (attempt + 1))
    return {"id": q["id"], "code": None, "confidence": 0.0, "reason": f"失败：{last_err}", "review": False}


async def main():
    ap = argparse.ArgumentParser(description="LLM 三级考点打标")
    ap.add_argument("--limit", type=int, default=0, help="最多处理题数（0=全部未打标）")
    ap.add_argument("--module", help="只处理指定模块 key（ziliao/shuliang/yanyu/panduan/changshi）")
    ap.add_argument("--dry-run", action="store_true", help="只打印判定结果，不写库")
    ap.add_argument("--concurrency", type=int, default=3, help="并发请求数（默认 3）")
    ap.add_argument("--sleep", type=float, default=0.2, help="每题提交间隔秒数（限速）")
    args = ap.parse_args()

    batch = 200
    total = args.limit or 10**9
    stats = {"tagged": 0, "unknown": 0, "review": 0, "failed": 0}
    low_conf: list[dict] = []
    sem = asyncio.Semaphore(max(1, args.concurrency))
    t0 = time.time()

    async def worker(q):
        async with sem:
            r = await tag_one(q, args.dry_run)
            await asyncio.sleep(args.sleep)
            return r

    done = 0
    while done < total:
        todo = fetch_untagged(args.module, min(batch, total - done))
        if not todo:
            break
        if args.dry_run and done:
            break  # dry-run 不写库，避免重复取同一批死循环
        results = await asyncio.gather(*(worker(q) for q in todo))
        for r in results:
            done += 1
            if r["code"] is None:
                stats["failed"] += 1
            elif r["code"] == "UNKNOWN":
                stats["unknown"] += 1
                stats["tagged"] += 1
            else:
                stats["tagged"] += 1
            if r["review"]:
                stats["review"] += 1
                low_conf.append(r)
            print(f"[{done}] q{r['id']} -> {r['code']} (conf={r['confidence']:.2f}) {r['reason']}")
        if args.dry_run:
            break

    dt = time.time() - t0
    print("\n===== 打标统计 =====")
    print(f"处理 {done} 题，用时 {dt:.0f}s；成功写标 {stats['tagged']}，其中 UNKNOWN {stats['unknown']}，"
          f"低置信/待抽审 {stats['review']}，失败(未写库，可重跑) {stats['failed']}")
    if low_conf:
        print("\n===== 低置信样本清单（已存 tag3_review）=====")
        for r in low_conf[:50]:
            print(f"q{r['id']} {r['code']} conf={r['confidence']:.2f} {r['reason']}")


if __name__ == "__main__":
    asyncio.run(main())
