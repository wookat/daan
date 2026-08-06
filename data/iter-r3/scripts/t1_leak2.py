#!/usr/bin/env python3
"""T1 泄漏残余收口：轮2 T2a 记 keep 的 1,039 题（两轮改写未过校验），逐题重跑改写管线，
带错误反馈的多轮重试（最多3轮，每轮把上一轮校验失败原因与目标长度带回给模型）。
仍无法自然均衡的记 keep 并保留最终失败原因。
输出 out/t1_leak2.jsonl：{"id","options","attempts"} 或 {"id","skip":reason,"attempts"}"""
import json, os, sqlite3, sys, threading
from concurrent.futures import ThreadPoolExecutor
from llm_common import llm

DB = os.environ.get('SNAP', '/home/ubuntu/r3/snap_r3.db')
OUT = os.environ.get('OUTDIR', '/home/ubuntu/r3/out')
LEDGER_R2 = os.environ.get('LEDGER_R2', '/home/ubuntu/repos/kaogong-assistant/data/iter-r2/ledger.jsonl')
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 0

SYS = ('你是公务员考试命题专家。下面选择题的正确项是完整表述，而干扰项过短，'
       '考生可通过"选最长的"猜出答案。请改写全部干扰项（错误选项）：\n'
       '1. 每个干扰项改写为与正确项长度相近的完整表述，字数控制在指定区间内（见用户消息）；\n'
       '2. 必须保持干扰项的错误性（表述内容依旧错误或不符合题意），不得与正确项同义；\n'
       '3. 正确项一个字都不能改，必须原样返回；不得调换选项位置，字母保持不变；\n'
       '4. 干扰项应似是而非、有迷惑性，风格与正确项一致，不要机械堆砌修饰语。\n'
       '输出 JSON：{"options":{"A":"...","B":"...","C":"...","D":"..."}}（含全部选项，正确项原样保留）')


def leaky(opts, ans):
    lens = sorted(((len(str(v)), k) for k, v in opts.items()), reverse=True)
    return lens[0][1] == ans and len(lens) > 1 and lens[0][0] >= 1.5 * lens[1][0]


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


conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
keep_ids = []
for l in open(LEDGER_R2):
    d = json.loads(l)
    if d.get('task') == 'T2a' and d.get('action') == 'keep':
        keep_ids.append(d['id'])
targets = []
for qid in keep_ids:
    r = conn.execute("SELECT id, question, options, answer, disabled FROM questions WHERE id=?", (qid,)).fetchone()
    if not r or r['disabled']:
        continue
    try:
        opts = json.loads(r['options'])
    except Exception:
        continue
    a = (r['answer'] or '').strip().upper()
    if a in opts and leaky(opts, a):
        targets.append((r['id'], r['question'], opts, a))
    else:
        targets.append((r['id'], r['question'], opts, a))  # 仍逐题过管线，check 会判定
path = os.path.join(OUT, 't1_leak2.jsonl')
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
print(len(targets), 'to run (keeps', len(keep_ids), ')')
lock = threading.Lock()
f = open(path, 'a', encoding='utf-8')
cnt = [0]


def go(t):
    qid, q, opts, a = t
    if not leaky(opts, a):
        res = {'id': qid, 'skip': 'no longer leaky', 'attempts': 0}
    else:
        clen = len(str(opts[a]))
        lo, hi = max(2, int(clen * 0.7)), int(clen * 1.2)
        base = (f"题目：{q}\n选项：" + ' '.join(f"{k}.{v}" for k, v in sorted(opts.items())) +
                f"\n正确项：{a}（{clen}字，原样保留）\n每个干扰项目标字数：{lo}~{hi}字")
        res = {'id': qid}
        fb = ''
        for attempt in range(3):
            out = llm(SYS, base + fb)
            if out.get('error'):
                res['skip'] = out['error']
                fb = ''
                continue
            new = out.get('options')
            err = check(opts, new, a)
            if err is None:
                res = {'id': qid, 'options': new, 'attempts': attempt + 1}
                break
            res['skip'] = err
            res['attempts'] = attempt + 1
            if isinstance(new, dict):
                fb = (f"\n\n上一轮你的输出未通过校验，失败原因：{err}。上一轮输出："
                      + json.dumps(new, ensure_ascii=False)
                      + f"\n请修正：干扰项字数须在{lo}~{hi}字内且最长选项不得比第二长长1.5倍以上；正确项{a}必须逐字保留。")
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
