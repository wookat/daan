#!/usr/bin/env python3
"""T1 阶段2：独立作答二审（不看阶段1结果与标注答案，只解题）。
输出 out/t1_stage2.jsonl：{"id","answer"}"""
import json, os, sqlite3, sys, threading
from concurrent.futures import ThreadPoolExecutor
from llm_common import llm, fmt_options

DB = os.environ.get('SNAP', '/home/ubuntu/r2b/snap_r2.db')
OUT = os.environ.get('OUTDIR', '/home/ubuntu/r2b/out')
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 0

SYS = ('你是公务员行测数量关系解题专家。仔细独立解答下面的选择题，先在心里逐步推理，'
       '只输出 JSON：{"answer":"A|B|C|D"}')

conn = sqlite3.connect(DB, check_same_thread=False)
conn.row_factory = sqlite3.Row
ids = [json.loads(l)['id'] for l in open(os.path.join(OUT, 't1_stage1.jsonl'))]
path = os.path.join(OUT, 't1_stage2.jsonl')
done = set()
if os.path.exists(path):
    for l in open(path):
        try:
            done.add(json.loads(l)['id'])
        except Exception:
            pass
ids = [i for i in set(ids) if i not in done]
if LIMIT:
    ids = sorted(ids)[:LIMIT]
print(len(ids), 'to run')
lock = threading.Lock()
f = open(path, 'a', encoding='utf-8')
cnt = [0]


qrows = {r['id']: r for r in conn.execute(
    "SELECT id, question, options FROM questions WHERE module='shuliang'")}


def go(qid):
    r = qrows[qid]
    try:
        opts = json.loads(r['options'])
    except Exception:
        opts = {}
    out = llm(SYS, f"题目：{r['question']}\n选项：{fmt_options(opts)}")
    res = {'id': qid, 'answer': (out.get('answer') or '').strip().upper() if not out.get('error') else None,
           'error': out.get('error')}
    with lock:
        f.write(json.dumps(res, ensure_ascii=False) + '\n')
        f.flush()
        cnt[0] += 1
        if cnt[0] % 200 == 0:
            print(cnt[0], flush=True)


with ThreadPoolExecutor(48) as ex:
    list(ex.map(go, ids))
f.close()
print('done')
