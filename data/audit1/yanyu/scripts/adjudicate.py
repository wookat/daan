"""二审：对一审 LLM 与库内答案不一致（或题面 flaw）的题，带解析深度复核。
输出 adjudicate_results.jsonl。输入：disagree_ids.json"""
import json, os, asyncio, aiohttp, time

API = os.environ.get("LLM_API", "https://api.deepseek.com/v1/chat/completions")
KEY = os.environ.get("LLM_KEY") or os.environ["DEEPSEEK_API_KEY"]
MODEL = os.environ.get("LLM_MODEL", "deepseek-reasoner")
CONC = 32

SYS = """你是公务员考试言语理解模块的命题审核专家。下面给出一道在架题、库内标注答案与官方解析。另一位审核员独立解题得到了不同答案。请你仔细独立分析后裁决，输出严格JSON：
{"correct_answer":"A/B/C/D/X(X=题面残缺无法作答)","db_answer_verdict":"correct/wrong/unanswerable","explanation_matches_answer":true/false,"clerical_fix":"若属于答案字段笔误(解析明确支持另一选项)给出应改成的字母，否则null","reason":"50字内裁决理由"}
只输出JSON。"""

async def one(session, sem, r, out, lock):
    prompt = (f"题目：{r['question']}\n选项：{r['options']}\n库内答案：{r['answer']}\n"
              f"官方解析：{(r.get('explanation') or '（无解析）')[:1200]}")
    async with sem:
        for attempt in range(4):
            try:
                async with session.post(API, json={
                    "model": MODEL,
                    "messages": [{"role":"system","content":SYS},{"role":"user","content":prompt}],
                    "max_tokens": 8000,
                }, headers={"Authorization": f"Bearer {KEY}"},
                   timeout=aiohttp.ClientTimeout(total=600)) as resp:
                    j = await resp.json()
                    txt = j["choices"][0]["message"]["content"]
                    s, e = txt.find("{"), txt.rfind("}")
                    parsed = json.loads(txt[s:e+1])
                    rec = {"id": r["id"], **parsed}
                    async with lock:
                        out.write(json.dumps(rec, ensure_ascii=False)+"\n"); out.flush()
                    return
            except Exception as ex:
                if attempt == 3:
                    async with lock:
                        out.write(json.dumps({"id": r["id"], "error": str(ex)[:200]}, ensure_ascii=False)+"\n"); out.flush()
                else:
                    await asyncio.sleep(3*(attempt+1))

async def main():
    ids = set(json.load(open("disagree_ids.json")))
    done = set()
    if os.path.exists("adjudicate_results.jsonl"):
        for l in open("adjudicate_results.jsonl"):
            try:
                j = json.loads(l)
                if "error" not in j:
                    done.add(j["id"])
            except Exception:
                pass
    todo = []
    for l in open("audit_yanyu.jsonl", encoding="utf-8"):
        r = json.loads(l)
        if r["id"] in ids and r["id"] not in done:
            todo.append(r)
    print("todo:", len(todo), flush=True)
    out = open("adjudicate_results.jsonl", "a", encoding="utf-8")
    sem = asyncio.Semaphore(CONC)
    lock = asyncio.Lock()
    t0 = time.time()
    async with aiohttp.ClientSession() as session:
        tasks = [one(session, sem, r, out, lock) for r in todo]
        for i in range(0, len(tasks), 500):
            await asyncio.gather(*tasks[i:i+500])
            print(f"{min(i+500,len(tasks))}/{len(tasks)} elapsed {time.time()-t0:.0f}s", flush=True)

asyncio.run(main())
