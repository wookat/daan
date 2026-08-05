"""LLM 独立解题：对每道题让 deepseek-v4-flash 独立作答（不给原答案/解析），
并给出 tag3 归档建议与题面完整性判断。输出 solve_results.jsonl，可断点续跑。"""
import json, os, asyncio, aiohttp, sys, time

API = "https://api.deepseek.com/v1/chat/completions"
KEY = os.environ["DEEPSEEK_API_KEY"]
MODEL = "deepseek-chat"
CONC = 64

TAX = """YY-LJ-01实词辨析 YY-LJ-02成语辨析 YY-LJ-03关联词与语境对应 YY-LJ-04多空综合（以上=逻辑填空）
YY-ZX-01转折结构 YY-ZX-02因果结构 YY-ZX-03对策结构 YY-ZX-04主题词与行文脉络 YY-ZX-05意图判断（以上=中心理解/意图判断）
YY-XJ-01细节判断 YY-XJ-02细节查找 YY-XJ-03词句理解（以上=细节理解）
YY-JB-01语句排序 YY-JB-02语句填空 YY-JB-03接语选择 YY-JB-04病句与歧义（以上=语句表达）
YY-BT-01标题选择 YY-PZ-01篇章综合"""

SYS = f"""你是公务员考试言语理解模块的资深命题审核专家。独立解答给出的题目（不要臆测出题人意图之外的答案），并输出严格JSON：
{{"answer":"A/B/C/D 或 X(题目无法作答/题面残缺)","confidence":"high/med/low","tag3":"最贴切的考点码","flaw":"none 或 简述题面缺陷(题干残缺/选项残缺/选项混入解析/非言语题等)"}}
考点码表：
{TAX}
只输出JSON，不要其他文字。"""

async def one(session, sem, r, out, lock):
    prompt = f"题目：{r['question']}\n选项：{r['options']}"
    async with sem:
        for attempt in range(4):
            try:
                async with session.post(API, json={
                    "model": MODEL,
                    "messages": [{"role":"system","content":SYS},{"role":"user","content":prompt}],
                    "temperature": 0.0, "max_tokens": 200,
                    "response_format": {"type":"json_object"},
                }, headers={"Authorization": f"Bearer {KEY}"},
                   timeout=aiohttp.ClientTimeout(total=120)) as resp:
                    j = await resp.json()
                    txt = j["choices"][0]["message"]["content"]
                    parsed = json.loads(txt)
                    rec = {"id": r["id"], **{k: parsed.get(k) for k in ("answer","confidence","tag3","flaw")}}
                    async with lock:
                        out.write(json.dumps(rec, ensure_ascii=False)+"\n"); out.flush()
                    return
            except Exception as e:
                if attempt == 3:
                    async with lock:
                        out.write(json.dumps({"id": r["id"], "error": str(e)[:200]}, ensure_ascii=False)+"\n"); out.flush()
                else:
                    await asyncio.sleep(2*(attempt+1))

async def main():
    done = set()
    if os.path.exists("solve_results.jsonl"):
        for l in open("solve_results.jsonl"):
            try:
                j = json.loads(l)
                if "error" not in j:
                    done.add(j["id"])
            except Exception:
                pass
    todo = []
    src = sys.argv[1] if len(sys.argv) > 1 else "audit_yanyu.jsonl"
    for l in open(src, encoding="utf-8"):
        r = json.loads(l)
        if r["id"] not in done:
            todo.append(r)
    print("todo:", len(todo), flush=True)
    out = open("solve_results.jsonl", "a", encoding="utf-8")
    sem = asyncio.Semaphore(CONC)
    lock = asyncio.Lock()
    t0 = time.time()
    async with aiohttp.ClientSession() as session:
        tasks = [one(session, sem, r, out, lock) for r in todo]
        for i in range(0, len(tasks), 2000):
            await asyncio.gather(*tasks[i:i+2000])
            print(f"{min(i+2000,len(tasks))}/{len(tasks)} elapsed {time.time()-t0:.0f}s", flush=True)

asyncio.run(main())
