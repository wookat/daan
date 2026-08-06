#!/usr/bin/env python3
"""T2 二次处理：第一遍改写结果与全库/批内题干撞车（duplicate question）的题，
带唯一性反馈重试（要求保留原题干的具体对象词、避开撞车句式），仍撞车则记 skip。
输出追加到 out/t2_stem_full.jsonl（后写覆盖先写，build_outputs 取每 id 最后一条）。"""
import json, os, re, sqlite3, threading
from concurrent.futures import ThreadPoolExecutor
from llm_common import llm, fmt_options

DB = os.environ.get('SNAP', '/home/ubuntu/r3/snap_r3.db')
OUT = os.environ.get('OUTDIR', '/home/ubuntu/r3/out')

SYS_RW = ('你是公务员考试命题专家。下面选择题的题干是生硬的模板句（"…之X是"式），'
          '请把题干改写为自然、通顺、且表述独特的中文问句，要求：\n'
          '1. 保持考查的知识点与指向的正确答案完全不变；不得引入新限定条件；不改选项；\n'
          '2. 必须保留原题干中的具体对象词（如具体人名/地名/法律名/概念名），'
          '不得泛化成"下列说法正确的是"这类无对象的通用句；\n'
          '3. 题干长度10~60字。\n输出 JSON：{"question":"..."}')
SYS_SOLVE = ('你是公务员考试解题专家。独立解答下面的选择题，只输出 JSON：{"answer":"A|B|C|D"}')

pat = re.compile(r'之[\u4e00-\u9fa5]{1,4}是[:：]?$')
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
path = os.path.join(OUT, 't2_stem_full.jsonl')
last = {}
new_qs = set()
for l in open(path):
    d = json.loads(l)
    last[d['id']] = d
    if 'question' in d:
        new_qs.add(d['question'])
existing = {r[0] for r in conn.execute('SELECT question FROM questions')} | new_qs
targets = []
for qid, d in last.items():
    if d.get('skip') == 'duplicate question':
        r = conn.execute('SELECT id, question, options, answer FROM questions WHERE id=?', (qid,)).fetchone()
        targets.append((r['id'], r['question'], r['options'], (r['answer'] or '').strip().upper()))
print(len(targets), 'duplicates to retry')
lock = threading.Lock()
f = open(path, 'a', encoding='utf-8')


def go(t):
    qid, q, options, a = t
    try:
        opts = json.loads(options)
    except Exception:
        opts = {}
    res = {'id': qid, 'skip': 'duplicate question'}
    for attempt in range(2):
        out = llm(SYS_RW, f"题干：{q}\n选项：{fmt_options(opts)}\n正确项：{a}.{opts.get(a, '')}"
                  + ('' if attempt == 0 else '\n注意：上次改写与库内已有题干重复，请换一种独特表述。'))
        nq = (out.get('question') or '').strip() if not out.get('error') else ''
        if not (10 <= len(nq) <= 80) or pat.search(nq):
            res = {'id': qid, 'skip': 'rewrite failed'}
            continue
        with lock:
            dup = nq in existing
            if not dup:
                existing.add(nq)
        if dup:
            res = {'id': qid, 'skip': 'duplicate question'}
            continue
        sol = llm(SYS_SOLVE, f"题目：{nq}\n选项：{fmt_options(opts)}")
        if (sol.get('answer') or '').strip().upper() == a:
            res = {'id': qid, 'question': nq}
        else:
            res = {'id': qid, 'skip': f"solver {sol.get('answer')} != {a}"}
        break
    with lock:
        f.write(json.dumps(res, ensure_ascii=False) + '\n')
        f.flush()


with ThreadPoolExecutor(32) as ex:
    list(ex.map(go, targets))
f.close()
print('done')
