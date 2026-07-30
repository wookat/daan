"""讲解质量评测：答案正确率 / 模块识别率 / 方法引用率。"""
import asyncio
import json
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from app import engine  # noqa: E402


async def eval_one(q: dict) -> dict:
    extracted = await engine.extract_question(None, None, q["text"])
    explanation = await engine.explain(extracted)
    m = re.search(r"##\s*答案[\s\S]{0,120}?([A-D])", explanation)
    pred = m.group(1) if m else None
    return {
        "id": q["id"],
        "module_ok": extracted.get("module") == q["module"],
        "module_pred": extracted.get("module"),
        "answer_ok": pred == q["answer"],
        "answer_pred": pred,
        "answer_gold": q["answer"],
        "method_cited": any(kw in explanation for kw in q["expect_methods"]),
        "explanation": explanation,
    }


async def main():
    path = os.path.join(os.path.dirname(__file__), "questions.jsonl")
    qs = [json.loads(l) for l in open(path, encoding="utf-8") if l.strip()]
    results = await asyncio.gather(*[eval_one(q) for q in qs])
    n = len(results)
    print(f"n={n}")
    print(f"module_acc={sum(r['module_ok'] for r in results)}/{n}")
    print(f"answer_acc={sum(r['answer_ok'] for r in results)}/{n}")
    print(f"method_cite={sum(r['method_cited'] for r in results)}/{n}")
    for r in results:
        flag = "OK " if r["answer_ok"] and r["module_ok"] and r["method_cited"] else "BAD"
        print(f"{flag} id={r['id']} module={r['module_pred']}({r['module_ok']}) "
              f"ans={r['answer_pred']}/{r['answer_gold']}({r['answer_ok']}) method={r['method_cited']}")
    out = os.path.join(os.path.dirname(__file__), "eval_results.json")
    json.dump(results, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"saved {out}")


if __name__ == "__main__":
    asyncio.run(main())
