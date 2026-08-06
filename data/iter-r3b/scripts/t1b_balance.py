#!/usr/bin/env python3
"""R3b-T1 全库 original 生成题干扰项长度均衡化。
口径（与线上回归一致）：在架、有唯一最长选项的题中，正确项恰为最长 = 泄漏。
现状（快照 snap_r3b）：panduan 91.8% / yanyu 96.2% / changshi 65.2% / ziliao 35.3% / shuliang 4.7%。
做法：每模块随机（seed=4343）抽取足量泄漏题改写干扰项（正确项内容与字母不动），
使正确项不再是唯一最长；保留一部分泄漏题不动，避免出现"最长必错"的反向信号，
目标各模块 original 泄漏率 ≈30%（≤35% 门槛留余量）。
校验：键集不变 / 正确项逐字不变 / 无重复空选项 / 正确项非唯一最长 / 长度带宽 max≤3×min。
输出 out3b/t1b.jsonl：{"id","options"} 或 {"id","skip":reason}"""
import json, os, random, sqlite3, sys, threading
from concurrent.futures import ThreadPoolExecutor
from llm_common import llm

DB = os.environ.get('SNAP', '/home/ubuntu/r3/snap_r3b.db')
OUT = os.environ.get('OUTDIR', '/home/ubuntu/r3/out3b')
TARGET_RATE = float(os.environ.get('TARGET_RATE', '0.30'))
BUFFER = float(os.environ.get('BUFFER', '1.10'))  # 改写失败余量
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 0

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


conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
by_mod = {}
for r in conn.execute("SELECT id, module, question, options, answer FROM questions "
                      "WHERE disabled=0 AND source='original'"):
    try:
        opts = json.loads(r['options'])
    except Exception:
        continue
    a = (r['answer'] or '').strip().upper()
    if a not in opts or len(opts) < 2:
        continue
    d = by_mod.setdefault(r['module'], {'D': 0, 'leaky': []})
    if uniq_longest(opts) is None:
        continue
    d['D'] += 1
    if uniq_longest(opts) == a:
        d['leaky'].append((r['id'], r['question'], opts, a))

targets = []
rng = random.Random(4343)
for m, d in sorted(by_mod.items()):
    need = max(0, len(d['leaky']) - int(TARGET_RATE * d['D']))
    n = min(len(d['leaky']), int(need * BUFFER))
    rng.shuffle(d['leaky'])
    targets += d['leaky'][:n]
    print(f"{m}: D={d['D']} leaky={len(d['leaky'])} ({len(d['leaky'])/d['D']*100:.1f}%) sample={n}")

path = os.path.join(OUT, 't1b.jsonl')
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


def go(t):
    qid, q, opts, a = t
    clen = len(str(opts[a]))
    base = (f"题目：{q}\n选项：" + ' '.join(f"{k}.{v}" for k, v in sorted(opts.items())) +
            f"\n正确项：{a}（{clen}字，原样保留）\n干扰项目标字数：{max(2, int(clen*0.8))}~{max(3, int(clen*1.3))}字，"
            f"至少一个干扰项不少于{clen}字")
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
            fb = ('\n\n上一轮输出未过校验，失败原因：' + err + '。上一轮输出：'
                  + json.dumps(new, ensure_ascii=False)
                  + f'\n请修正：至少一个干扰项字数≥{clen}；正确项{a}逐字保留；各选项字数最长≤最短3倍。')
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
