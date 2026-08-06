#!/usr/bin/env python3
"""T2 模板化题干全量治理：轮1 T2 改写题中 `…之X是` 类模板题干（轮2已抽样改写 754 题），
（非轮1改写题中命中同正则的题干多为自然句式如“之比是/之差最大的是”，非模板，不入清单），
本轮把剩余候选全量清单化并逐题改写为自然问法（不改选项与考点指向），
改写后独立作答校验（deepseek 不看标注答案作答，答案不一致则跳过）。
输出 out/t2_stem_full.jsonl：{"id","question"} 或 {"id","skip":reason}"""
import json, os, re, sqlite3, sys, threading
from concurrent.futures import ThreadPoolExecutor
from llm_common import llm, fmt_options

DB = os.environ.get('SNAP', '/home/ubuntu/r3/snap_r3.db')
OUT = os.environ.get('OUTDIR', '/home/ubuntu/r3/out')
LEDGER_R1 = os.environ.get('LEDGER_R1', '/home/ubuntu/repos/kaogong-assistant/data/iter-r1/ledger.jsonl')
LEDGER_R2 = os.environ.get('LEDGER_R2', '/home/ubuntu/repos/kaogong-assistant/data/iter-r2/ledger.jsonl')
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 0

SYS_RW = ('你是公务员考试命题专家。下面常识选择题的题干是生硬的模板句（"…之X是"式），'
          '请把题干改写为自然、通顺的中文问句，要求：\n'
          '1. 保持考查的知识点与指向的正确答案完全不变；\n'
          '2. 不得引入新的限定条件或改变题意；不改选项；\n'
          '3. 题干长度10~60字，符合考试风格（如"下列关于…的说法正确的是""…指的是"等自然句式）。\n'
          '输出 JSON：{"question":"..."}')
SYS_SOLVE = ('你是公务员考试解题专家。独立解答下面的选择题，只输出 JSON：{"answer":"A|B|C|D"}')

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
t2fix = set()
for l in open(LEDGER_R1):
    d = json.loads(l)
    if d.get('task') == 'T2' and d.get('action') == 'fix':
        t2fix.add(d['id'])
r2done = set()
for l in open(LEDGER_R2):
    d = json.loads(l)
    if d.get('task') == 'T2b' and d.get('action') == 'fix':
        r2done.add(d['id'])
pat = re.compile(r'之[\u4e00-\u9fa5]{1,4}是[:：]?$')
existing = {r[0] for r in conn.execute("SELECT question FROM questions")}
cands = []
for r in conn.execute("SELECT id, question, options, answer FROM questions WHERE disabled=0 ORDER BY id"):
    if r['id'] in t2fix and r['id'] not in r2done and pat.search((r['question'] or '').strip()):
        cands.append((r['id'], r['question'], r['options'], (r['answer'] or '').strip().upper()))
path = os.path.join(OUT, 't2_stem_full.jsonl')
done = set()
seen_new = set()
if os.path.exists(path):
    for l in open(path):
        try:
            d = json.loads(l)
            done.add(d['id'])
            if 'question' in d:
                seen_new.add(d['question'])
        except Exception:
            pass
targets = [t for t in cands if t[0] not in done]
if LIMIT:
    targets = targets[:LIMIT]
print(len(targets), 'to run (candidates', len(cands), ')')
lock = threading.Lock()
f = open(path, 'a', encoding='utf-8')
cnt = [0]


def go(t):
    qid, q, options, a = t
    try:
        opts = json.loads(options)
    except Exception:
        opts = {}
    res = {'id': qid}
    out = llm(SYS_RW, f"题干：{q}\n选项：{fmt_options(opts)}\n正确项：{a}.{opts.get(a, '')}")
    nq = (out.get('question') or '').strip() if not out.get('error') else ''
    if not (10 <= len(nq) <= 80) or pat.search(nq):
        res['skip'] = 'rewrite failed'
    else:
        with lock:
            dup = nq in existing or nq in seen_new
            if not dup:
                seen_new.add(nq)
        if dup:
            res['skip'] = 'duplicate question'
        else:
            sol = llm(SYS_SOLVE, f"题目：{nq}\n选项：{fmt_options(opts)}")
            if (sol.get('answer') or '').strip().upper() == a:
                res = {'id': qid, 'question': nq}
            else:
                res['skip'] = f"solver {sol.get('answer')} != {a}"
    with lock:
        f.write(json.dumps(res, ensure_ascii=False) + '\n')
        f.flush()
        cnt[0] += 1
        if cnt[0] % 100 == 0:
            print(cnt[0], flush=True)


with ThreadPoolExecutor(32) as ex:
    list(ex.map(go, targets))
f.close()
print('done')
