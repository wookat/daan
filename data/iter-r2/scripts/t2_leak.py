#!/usr/bin/env python3
"""T2a 答案长度泄漏收口：对轮1 T2 改写题中「正确项为最长选项(≥1.5×第二长)」的题，
LLM 扩写干扰项使长度分布自然（不动正确项内容与字母）。程序校验后落盘。
输出 out/t2_leak.jsonl：{"id","options"} 或 {"id","skip":reason}"""
import json, os, re, sqlite3, sys, threading
from concurrent.futures import ThreadPoolExecutor
from llm_common import llm

DB = os.environ.get('SNAP', '/home/ubuntu/r2b/snap_r2.db')
OUT = os.environ.get('OUTDIR', '/home/ubuntu/r2b/out')
LEDGER_R1 = os.environ.get('LEDGER_R1', '/home/ubuntu/repos/kaogong-assistant/data/iter-r1/ledger.jsonl')
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 0

SYS = ('你是公务员考试命题专家。下面选择题的正确项是完整表述，而干扰项过短，'
       '考生可通过"选最长的"猜出答案。请改写全部干扰项（错误选项）：\n'
       '1. 每个干扰项扩写为与正确项长度相近的完整表述（长度为正确项的0.7~1.2倍）；\n'
       '2. 必须保持干扰项的错误性（表述内容依旧错误或不符合题意），不得与正确项同义；\n'
       '3. 不得改动正确项的内容与字母，不得调换选项位置；干扰项字母保持不变；\n'
       '4. 干扰项应似是而非、有迷惑性，风格与正确项一致。\n'
       '输出 JSON：{"options":{"A":"...","B":"...","C":"...","D":"..."}}（含全部选项，正确项原样保留）')

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
t2fix = set()
for l in open(LEDGER_R1):
    d = json.loads(l)
    if d.get('task') == 'T2' and d.get('action') == 'fix':
        t2fix.add(d['id'])


def leaky(opts, ans):
    lens = sorted(((len(str(v)), k) for k, v in opts.items()), reverse=True)
    return lens[0][1] == ans and len(lens) > 1 and lens[0][0] >= 1.5 * lens[1][0]


targets = []
for r in conn.execute("SELECT id, question, options, answer FROM questions WHERE disabled=0"):
    if r['id'] not in t2fix:
        continue
    try:
        opts = json.loads(r['options'])
    except Exception:
        continue
    a = (r['answer'] or '').strip().upper()
    if a in opts and leaky(opts, a):
        targets.append((r['id'], r['question'], opts, a))
path = os.path.join(OUT, 't2_leak.jsonl')
done = set()
if os.path.exists(path):
    for l in open(path):
        try:
            done.add(json.loads(l)['id'])
        except Exception:
            pass
targets = [t for t in targets if t[0] not in done]
if LIMIT:
    targets = targets[:LIMIT]
print(len(targets), 'to run')
lock = threading.Lock()
f = open(path, 'a', encoding='utf-8')
cnt = [0]


def check(old, new, ans):
    if not isinstance(new, dict) or set(new) != set(old):
        return 'bad keys'
    if str(new[ans]).strip() != str(old[ans]).strip():
        return 'correct option changed'
    vals = [str(v).strip() for v in new.values()]
    if len(set(vals)) != len(vals) or not all(vals):
        return 'dup/empty option'
    if leaky(new, ans):
        return 'still leaky'
    lens = [len(str(v)) for v in new.values()]
    if max(lens) > 3 * min(lens):
        return 'length out of band'
    return None


def go(t):
    qid, q, opts, a = t
    user = f"题目：{q}\n选项：" + ' '.join(f"{k}.{v}" for k, v in sorted(opts.items())) + f"\n正确项：{a}"
    res = {'id': qid}
    for attempt in range(2):
        out = llm(SYS, user)
        if out.get('error'):
            res['skip'] = out['error']
            continue
        new = out.get('options')
        err = check(opts, new, a)
        if err is None:
            res = {'id': qid, 'options': new}
            break
        res['skip'] = err
    with lock:
        f.write(json.dumps(res, ensure_ascii=False) + '\n')
        f.flush()
        cnt[0] += 1
        if cnt[0] % 200 == 0:
            print(cnt[0], flush=True)


with ThreadPoolExecutor(48) as ex:
    list(ex.map(go, targets))
f.close()
print('done')
