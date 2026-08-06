#!/usr/bin/env python3
"""T1 数量低分簇 阶段1：LLM 独立解题 + 解析改写 + 给出可验算表达式。
输出 out/t1_stage1.jsonl：{"id","answer","expr","explanation"}"""
import json, os, sqlite3, sys, threading
from concurrent.futures import ThreadPoolExecutor
from llm_common import llm, fmt_options

DB = os.environ.get('SNAP', '/home/ubuntu/r2b/snap_r2.db')
OUT = os.environ.get('OUTDIR', '/home/ubuntu/r2b/out')
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 0

SYS = ('你是公务员行测数量关系解题专家。独立解答下面的选择题（不要参考任何既有答案或解析）。'
       '要求输出 JSON：{"answer":"A|B|C|D","expr":"...","explanation":"..."}。\n'
       'expr：一个可直接用 Python eval 计算出数值答案的算术表达式（只能包含数字、+-*/()、**、小数点，'
       '不能含变量或函数），其计算结果应等于正确选项的数值；若该题答案不是单一数值（如比例、集合、无法用一个算式表达），expr 填 null。\n'
       'explanation：面向考生的成品解析，不超过90字，必须包含解题步骤或公式依据，'
       '可用"根据/代入/因此/所以"等结构词，结尾写"故选X"。禁止出现"解析应/建议/原题"等元评论，禁止提及本次改写。')

conn = sqlite3.connect(DB, check_same_thread=False)
conn.row_factory = sqlite3.Row
rows = conn.execute(
    "SELECT id, question, options FROM questions "
    "WHERE module='shuliang' AND disabled=0 AND quality_score<50 ORDER BY id").fetchall()

path = os.path.join(OUT, 't1_stage1.jsonl')
done = set()
if os.path.exists(path):
    for l in open(path):
        try:
            done.add(json.loads(l)['id'])
        except Exception:
            pass
items = [r for r in rows if r['id'] not in done]
if LIMIT:
    items = items[:LIMIT]
print(len(items), 'to run (total', len(rows), ')')
lock = threading.Lock()
f = open(path, 'a', encoding='utf-8')
cnt = [0]


def go(r):
    try:
        opts = json.loads(r['options'])
    except Exception:
        res = {'id': r['id'], 'error': 'bad options'}
        with lock:
            f.write(json.dumps(res, ensure_ascii=False) + '\n')
        return
    out = llm(SYS, f"题目：{r['question']}\n选项：{fmt_options(opts)}")
    res = {'id': r['id'], 'answer': (out.get('answer') or '').strip().upper() if not out.get('error') else None,
           'expr': out.get('expr'), 'explanation': (out.get('explanation') or '').strip(),
           'error': out.get('error')}
    with lock:
        f.write(json.dumps(res, ensure_ascii=False) + '\n')
        f.flush()
        cnt[0] += 1
        if cnt[0] % 200 == 0:
            print(cnt[0], flush=True)


with ThreadPoolExecutor(48) as ex:
    list(ex.map(go, items))
f.close()
print('done')
