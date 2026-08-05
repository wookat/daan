#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""UNKNOWN tag3 第二轮 LLM 辅助定标。

对规则无法覆盖的维持 UNKNOWN 题目，用 deepseek-v4-flash 按考点树逐题判定；
放行前需人工抽检正确率 ≥95%（见 report_round2.md）。

用法：DEEPSEEK_API_KEY=... python3 llm_retag.py <taxonomy.json> <pool.jsonl> <out.jsonl> [并发数]
输入 pool.jsonl 每行含 question_id/module/question/options/explanation。
输出每行 {"question_id", "module", "tag3", "confidence", "why"}；tag3 可为 UNKNOWN。
"""
import asyncio
import json
import os
import sys

import urllib.request

API = "https://api.deepseek.com/v1/chat/completions"
KEY = os.environ["DEEPSEEK_API_KEY"]


def taxonomy_text(tax_path):
    t = json.load(open(tax_path, encoding="utf-8"))
    lines = []
    code2mod = {}
    for m in t["modules"]:
        lines.append(f"## {m['key']}（{m['name']}）")
        for g in m["groups"]:
            for tp in g["topics"]:
                lines.append(f"{tp['code']} {tp['name']}：{tp['desc']}")
                code2mod[tp["code"]] = m["key"]
    return "\n".join(lines), code2mod


SYS = """你是行测题库考点标注专家。给定一道题（题干/选项/解析），从考点树中选出唯一最合适的三级考点 code。
规则：
1. 只能输出考点树中存在的 code；若信息不足或无对应考点，输出 UNKNOWN。
2. 题目可能被错放模块，请按题目实际内容跨模块选 code。
3. 解析可能缺失或是模板（如"故选X"），此时仅凭题干与选项判定；判定依据不足时宁可 UNKNOWN，不要猜。
4. 输出严格 JSON：{"tag3":"code或UNKNOWN","confidence":0到1,"why":"15字内依据"}
考点树：
"""


def call(payload):
    req = urllib.request.Request(API, data=json.dumps(payload).encode(),
                                 headers={"Authorization": f"Bearer {KEY}",
                                          "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


async def judge(sem, tax_txt, q):
    body = {
        "model": "deepseek-chat",
        "temperature": 0,
        "max_tokens": 120,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYS + tax_txt},
            {"role": "user", "content": json.dumps({
                "question": (q.get("question") or "")[:1500],
                "options": q.get("options"),
                "explanation": (q.get("explanation") or "")[:800],
                "module_hint": q.get("module"),
            }, ensure_ascii=False)},
        ],
    }
    async with sem:
        for attempt in range(4):
            try:
                resp = await asyncio.to_thread(call, body)
                out = json.loads(resp["choices"][0]["message"]["content"])
                return {"question_id": q["question_id"], "orig_module": q["module"],
                        "tag3": out.get("tag3", "UNKNOWN"),
                        "confidence": out.get("confidence", 0),
                        "why": str(out.get("why", ""))[:60]}
            except Exception as e:
                await asyncio.sleep(2 * (attempt + 1))
                err = str(e)
        return {"question_id": q["question_id"], "orig_module": q["module"],
                "tag3": "ERROR", "confidence": 0, "why": err[:60]}


async def main():
    tax_path, pool_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    conc = int(sys.argv[4]) if len(sys.argv) > 4 else 12
    tax_txt, code2mod = taxonomy_text(tax_path)
    done = set()
    if os.path.exists(out_path):
        for line in open(out_path, encoding="utf-8"):
            try:
                done.add(json.loads(line)["question_id"])
            except Exception:
                pass
    pool = [json.loads(l) for l in open(pool_path, encoding="utf-8")]
    pool = [q for q in pool if q["question_id"] not in done]
    print(f"pool {len(pool)} (skip {len(done)})", flush=True)
    sem = asyncio.Semaphore(conc)
    out = open(out_path, "a", encoding="utf-8")
    tasks = [judge(sem, tax_txt, q) for q in pool]
    n = 0
    for fut in asyncio.as_completed(tasks):
        r = await fut
        if r["tag3"] not in ("UNKNOWN", "ERROR") and r["tag3"] not in code2mod:
            r["tag3"] = "UNKNOWN"
            r["why"] = "非法code置UNKNOWN:" + r["why"]
        if r["tag3"] not in ("UNKNOWN", "ERROR"):
            r["module"] = code2mod[r["tag3"]]
        out.write(json.dumps(r, ensure_ascii=False) + "\n")
        n += 1
        if n % 200 == 0:
            out.flush()
            print(f"done {n}/{len(pool)}", flush=True)
    out.close()
    print("ALL DONE", n)


if __name__ == "__main__":
    asyncio.run(main())
