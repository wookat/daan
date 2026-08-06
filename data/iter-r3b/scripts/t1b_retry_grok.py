#!/usr/bin/env python3
"""R3b-T1 二遍：deepseek 三轮未过校验的题改用 grok-4.5 重试（提示词与校验同 t1b_balance）。
结果追加到 out3b/t1b.jsonl（build_outputs 取每 id 最后一条）。"""
import json, os, sqlite3, sys, threading
from concurrent.futures import ThreadPoolExecutor
from llm_common import llm

DB = os.environ.get('SNAP', '/home/ubuntu/r3/snap_r3b.db')
OUT = os.environ.get('OUTDIR', '/home/ubuntu/r3/out3b')
MODEL = os.environ.get('RETRY_MODEL', 'grok-4.5')
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 0
SHARD_N = int(os.environ.get('SHARD_N', '1'))
SHARD_I = int(os.environ.get('SHARD_I', '0'))

SYS = ('你是公务员考试命题专家。下面选择题的正确项是全部选项中最长的，'
       '考生可通过"选最长的"猜出答案。请改写干扰项（错误选项）以均衡长度：\n'
       '1. 改写后至少有一个干扰项的字数不少于正确项，且各选项字数相差不悬殊（最长不超过最短的3倍）；\n'
       '2. 必须保持每个干扰项的错误性（内容依旧错误或不符合题意），不得与正确项同义；\n'
       '3. 正确项一个字都不能改，必须原样返回；不得调换选项位置，字母保持不变；\n'
       '4. 干扰项应似是而非、有迷惑性，风格与正确项一致，不要机械堆砌修饰语。\n'
       '输出 JSON：{"options":{"A":"...","B":"...","C":"...","D":"..."}}（含全部选项，正确项原样保留）')


def uniq_longest(opts):
    lens = sorted(((len(str(v)), k) for k, v in opts.items()), reverse=True)
    if len(lens) < 2 or lens[0][0] == lens[1][0]:
        return None
    return lens[0][1]


def check(old, new, ans):
    if not isinstance(new, dict) or set(new) != set(old):
        return 'bad keys'
    if str(new[ans]).strip() != str(old[ans]).strip():
        return 'correct option changed'
    vals = [str(v).strip() for v in new.values()]
    if len(set(vals)) != len(vals) or not all(vals):
        return 'dup/empty option'
    if uniq_longest(new) == ans:
        return 'still longest'
    lens = [len(str(v)) for v in new.values()]
    if max(lens) > 3 * min(lens):
        return 'length out of band'
    return None


path = os.path.join(OUT, 't1b.jsonl')
last = {}
for l in open(path):
    d = json.loads(l)
    last[d['id']] = d
skip_ids = [qid for qid, d in last.items() if 'options' not in d and qid % SHARD_N == SHARD_I]
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
targets = []
for qid in skip_ids:
    r = conn.execute('SELECT id, question, options, answer FROM questions WHERE id=?', (qid,)).fetchone()
    try:
        opts = json.loads(r['options'])
    except Exception:
        continue
    targets.append((r['id'], r['question'], opts, (r['answer'] or '').strip().upper()))
if LIMIT:
    targets = targets[:LIMIT]
print(len(targets), 'to retry with', MODEL)
lock = threading.Lock()
f = open(path, 'a', encoding='utf-8')
cnt = [0]


def go(t):
    qid, q, opts, a = t
    clen = len(str(opts[a]))
    base = (f"题目：{q}\n选项：" + ' '.join(f"{k}.{v}" for k, v in sorted(opts.items())) +
            f"\n正确项：{a}（{clen}字，原样保留）\n干扰项目标字数：{max(2, int(clen*0.8))}~{max(3, int(clen*1.3))}字，"
            f"至少一个干扰项不少于{clen}字")
    res = {'id': qid}
    fb = ''
    for attempt in range(2):
        out = llm(SYS, base + fb, model=MODEL)
        if out.get('error'):
            res['skip'] = out['error']
            fb = ''
            continue
        new = out.get('options')
        err = check(opts, new, a)
        if err is None:
            res = {'id': qid, 'options': new, 'attempts': attempt + 1, 'model': MODEL}
            break
        res['skip'] = err
        if isinstance(new, dict):
            fb = ('\n\n上一轮输出未过校验，失败原因：' + err + '。上一轮输出：'
                  + json.dumps(new, ensure_ascii=False)
                  + f'\n请修正：至少一个干扰项字数≥{clen}；正确项{a}逐字保留；各选项字数最长≤最短3倍。')
    with lock:
        f.write(json.dumps(res, ensure_ascii=False) + '\n')
        f.flush()
        cnt[0] += 1
        if cnt[0] % 200 == 0:
            print(cnt[0], flush=True)


with ThreadPoolExecutor(32) as ex:
    list(ex.map(go, targets))
f.close()
print('done')
