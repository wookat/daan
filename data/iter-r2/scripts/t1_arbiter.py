#!/usr/bin/env python3
"""T1 阶段3：仲裁。对 阶段1/阶段2 与标注答案不一致的题，用 grok-4.5 独立解题。
若仲裁答案==标注 → 产出（含新解析与 expr）；否则维持下架决策。
输出 out/t1_arbiter.jsonl：{"id","answer","expr","explanation"}"""
import json, os, sqlite3, threading
from concurrent.futures import ThreadPoolExecutor
from llm_common import llm, fmt_options

DB = os.environ.get('SNAP', '/home/ubuntu/r2b/snap_r2.db')
OUT = os.environ.get('OUTDIR', '/home/ubuntu/r2b/out')

SYS = ('你是公务员行测数量关系解题专家。独立解答下面的选择题（不要参考任何既有答案或解析）。'
       '要求输出 JSON：{"answer":"A|B|C|D","expr":"...","explanation":"..."}。\n'
       'expr：一个可直接用 Python eval 计算出数值答案的算术表达式（只能包含数字、+-*/()、**、小数点，'
       '不能含变量或函数），其计算结果应等于正确选项的数值；若该题答案不是单一数值，expr 填 null。\n'
       'explanation：面向考生的成品解析，不超过90字，必须包含解题步骤或公式依据，'
       '可用"根据/代入/因此/所以"等结构词，结尾写"故选X"。禁止元评论。')

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
s1 = {json.loads(l)['id']: json.loads(l) for l in open(os.path.join(OUT, 't1_stage1.jsonl'))}
s2 = {json.loads(l)['id']: json.loads(l) for l in open(os.path.join(OUT, 't1_stage2.jsonl'))}
qrows = {r['id']: r for r in conn.execute(
    "SELECT id, question, options, answer FROM questions "
    "WHERE module='shuliang' AND disabled=0 AND quality_score<50")}
targets = []
for qid, r in qrows.items():
    lab = (r['answer'] or '').strip().upper()
    a1 = (s1.get(qid) or {}).get('answer')
    a2 = (s2.get(qid) or {}).get('answer')
    if not (a1 == lab and a2 == lab):
        targets.append(qid)
path = os.path.join(OUT, 't1_arbiter.jsonl')
done = set()
if os.path.exists(path):
    for l in open(path):
        try:
            done.add(json.loads(l)['id'])
        except Exception:
            pass
targets = [q for q in targets if q not in done]
print(len(targets), 'to arbitrate')
lock = threading.Lock()
f = open(path, 'a', encoding='utf-8')
cnt = [0]


def go(qid):
    r = qrows[qid]
    try:
        opts = json.loads(r['options'])
    except Exception:
        opts = {}
    out = llm(SYS, f"题目：{r['question']}\n选项：{fmt_options(opts)}", model='grok-4.5')
    res = {'id': qid, 'answer': (out.get('answer') or '').strip().upper() if not out.get('error') else None,
           'expr': out.get('expr'), 'explanation': (out.get('explanation') or '').strip(),
           'error': out.get('error')}
    with lock:
        f.write(json.dumps(res, ensure_ascii=False) + '\n')
        f.flush()
        cnt[0] += 1
        if cnt[0] % 100 == 0:
            print(cnt[0], flush=True)


with ThreadPoolExecutor(24) as ex:
    list(ex.map(go, targets))
f.close()
print('done')
