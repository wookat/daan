#!/usr/bin/env python3
"""R3b-T2 `之_是` 残留题干全量治理（在架 question LIKE '%之_是%'，662 条）。
含两类：自然句式（数量"之和是多少"、常识"之一是/之首是"、古文引用等）与
机械改写产物病句（如「"泥石流"沟谷之出的横向之逃是：」）。
管线：LLM 先判自然/病句——自然记 keep；病句结合解析改写为通顺自然问法
（不改考点与答案）→ 查重 → 独立作答二审；两轮仍失败的 original 自产题记 delist，
真题（is_real=1）保守记 keep 待人工。
输出 out3b/t2b.jsonl：{"id","action":"keep|fix|delist",...}"""
import json, os, re, sqlite3, sys, threading
from concurrent.futures import ThreadPoolExecutor
from llm_common import llm, fmt_options

DB = os.environ.get('SNAP', '/home/ubuntu/r3/snap_r3b.db')
OUT = os.environ.get('OUTDIR', '/home/ubuntu/r3/out3b')
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 0

SYS_JUDGE = ('你是中文编辑与公务员考试命题专家。判断下面选择题的题干是否为通顺自然的中文：\n'
             '- 自然：正常问法（如"两数之和是多少""……之一是""……之首是"、古文原文引用等）；\n'
             '- 病句：生硬堆砌"之X"的机械模板产物（如「"泥石流"沟谷之出的横向之逃是：」'
             '「凉州之课的武威之殖是：」），读不通或表意不明。\n'
             '输出 JSON：{"natural": true/false}')
SYS_RW = ('你是公务员考试命题专家。下面选择题的题干是机械改写产生的病句（生硬堆砌"之X"、表意不明）。'
          '请结合选项与解析理解本题真正考查的知识点，将题干改写为通顺自然的中文问句，要求：\n'
          '1. 保持考查的知识点与指向的正确答案完全不变；不改选项；\n'
          '2. 题干长度10~60字，自然句式（如"下列关于…的说法正确的是""…的做法正确的是"等）；\n'
          '3. 保留题干中的具体对象词（人名/地名/事物名），不得泛化为无对象的通用句。\n'
          '输出 JSON：{"question":"..."}')
SYS_SOLVE = ('你是公务员考试解题专家。独立解答下面的选择题，只输出 JSON：{"answer":"A|B|C|D"}')

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
existing = {r[0] for r in conn.execute('SELECT question FROM questions')}
targets = [dict(r) for r in conn.execute(
    "SELECT id, question, options, answer, explanation, is_real, source FROM questions "
    "WHERE disabled=0 AND question LIKE '%之_是%' ORDER BY id")]
path = os.path.join(OUT, 't2b.jsonl')
done = set()
seen_new = set()
if os.path.exists(path):
    for l in open(path):
        try:
            d = json.loads(l)
            done.add(d['id'])
            if d.get('action') == 'fix':
                seen_new.add(d['question'])
        except Exception:
            pass
targets = [t for t in targets if t['id'] not in done]
if LIMIT:
    targets = targets[:LIMIT]
print(len(targets), 'to run')
lock = threading.Lock()
f = open(path, 'a', encoding='utf-8')
cnt = [0]


def go(t):
    qid, q = t['id'], t['question']
    try:
        opts = json.loads(t['options'])
    except Exception:
        opts = {}
    a = (t['answer'] or '').strip().upper()
    j = llm(SYS_JUDGE, f"题干：{q}\n选项：{fmt_options(opts)}")
    if j.get('natural') is True:
        res = {'id': qid, 'action': 'keep', 'reason': '自然句式，非模板病句'}
    else:
        res = None
        last = 'rewrite failed'
        for attempt in range(2):
            out = llm(SYS_RW, f"题干：{q}\n选项：{fmt_options(opts)}\n正确项：{a}.{opts.get(a, '')}"
                      f"\n解析：{(t['explanation'] or '')[:300]}"
                      + ('' if attempt == 0 else f'\n上一轮改写未通过（{last}），请换一种表述。'))
            nq = (out.get('question') or '').strip() if not out.get('error') else ''
            if not (10 <= len(nq) <= 80) or '之_是' in nq or re.search(r'之[\u4e00-\u9fa5]是', nq):
                last = 'rewrite failed'
                continue
            with lock:
                dup = nq in existing or nq in seen_new
            if dup:
                last = 'duplicate'
                continue
            sol = llm(SYS_SOLVE, f"题目：{nq}\n选项：{fmt_options(opts)}")
            if (sol.get('answer') or '').strip().upper() == a:
                with lock:
                    seen_new.add(nq)
                res = {'id': qid, 'action': 'fix', 'question': nq}
                break
            last = f"solver {sol.get('answer')} != {a}"
        if res is None:
            if t['is_real'] == 1:
                res = {'id': qid, 'action': 'keep', 'reason': f'真题，改写未通过（{last}），保守保留待人工'}
            else:
                res = {'id': qid, 'action': 'delist', 'reason': f'病句且改写未通过（{last}）'}
    with lock:
        f.write(json.dumps(res, ensure_ascii=False) + '\n')
        f.flush()
        cnt[0] += 1
        if cnt[0] % 50 == 0:
            print(cnt[0], flush=True)


with ThreadPoolExecutor(32) as ex:
    list(ex.map(go, targets))
f.close()
print('done')
