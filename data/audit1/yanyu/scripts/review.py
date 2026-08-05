"""人工逐题核查工作台。
show <idx> <n>  打印从队列第 idx 条起 n 道题（含机检/一审风险提示，仅作提示）
mark <idx> <n> <json>  记录该批人工判定：json 为 {"exceptions": {id: {...}}}，
  未列入 exceptions 的默认 pass。写入 manual_ledger.jsonl（可覆盖重跑，后写覆盖先写）。
"""
import json, sys, os

recs = []
for l in open("audit_yanyu.jsonl", encoding="utf-8"):
    recs.append(json.loads(l))
mc = {json.loads(l)["id"]: json.loads(l)["issues"] for l in open("mc_results.jsonl")}
solve = {}
if os.path.exists("solve_results.jsonl"):
    for l in open("solve_results.jsonl"):
        j = json.loads(l)
        if "error" not in j:
            solve[j["id"]] = j
adj = {}
if os.path.exists("adjudicate_results.jsonl"):
    for l in open("adjudicate_results.jsonl"):
        j = json.loads(l)
        if "error" not in j:
            adj[j["id"]] = j
dup = {d["id"]: d["dup_of"] for d in json.load(open("dup_final.json"))["decisions"]}

def show(idx, n):
    for r in recs[idx:idx+n]:
        qid = r["id"]
        risk = []
        if mc.get(qid):
            risk += mc[qid]
        s = solve.get(qid)
        if s and (s.get("answer") or "")[:1] != r["answer"]:
            risk.append(f"LLM1:{(s.get('answer') or '')[:1]}")
        a = adj.get(qid)
        if a:
            risk.append(f"LLM2:{a.get('db_answer_verdict')}/{(a.get('correct_answer') or '')[:1]}")
        if qid in dup:
            risk.append(f"DUP_OF:{dup[qid]}")
        expl = (r.get("explanation") or "")
        print(f"#{qid}|{r.get('submodule')}|{r.get('tag3')}|ans={r['answer']}|{';'.join(risk) or '-'}")
        print("Q:" + r["question"].replace("\n", "⏎"))
        print("O:" + r["options"])
        print("E:" + expl.replace("\n", "⏎")[:400])
        print()

def mark(idx, n, payload):
    exceptions = payload.get("exceptions", {})
    with open("manual_ledger.jsonl", "a", encoding="utf-8") as f:
        for r in recs[idx:idx+n]:
            qid = r["id"]
            e = exceptions.get(str(qid)) or exceptions.get(qid)
            if e:
                row = {"id": qid, **e}
            else:
                row = {"id": qid, "verdict": "pass"}
            row["method"] = "manual-review"
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"marked {n} rows from idx {idx}, exceptions={len(exceptions)}")

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "show":
        show(int(sys.argv[2]), int(sys.argv[3]))
    elif cmd == "mark":
        mark(int(sys.argv[2]), int(sys.argv[3]), json.loads(sys.argv[4]))
    elif cmd == "progress":
        done = set()
        if os.path.exists("manual_ledger.jsonl"):
            for l in open("manual_ledger.jsonl"):
                done.add(json.loads(l)["id"])
        print(f"reviewed {len(done)}/{len(recs)}")
