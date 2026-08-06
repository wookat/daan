#!/usr/bin/env python3
"""orig 审查 fix 项二次精修：独立作答校验 + 生成最终解析（纯文本，无元评论）。
输出 out/llm_orig_refine.jsonl：{"id":..,"verdict":"fix|delist","explanation":..,"options":可选,"solved":"A"}"""
import sqlite3, json, os, time, threading
from concurrent.futures import ThreadPoolExecutor
import urllib.request

KEY = os.environ['DEEPSEEK_API_KEY']
OUT = '/home/ubuntu/work/out'
conn = sqlite3.connect('/home/ubuntu/snap_iter.db', check_same_thread=False); conn.row_factory = sqlite3.Row
lock = threading.Lock()

def llm(system, user, retries=4):
    body = json.dumps({'model': 'deepseek-chat', 'temperature': 0,
                       'response_format': {'type': 'json_object'},
                       'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}]}).encode()
    for a in range(retries):
        try:
            req = urllib.request.Request('https://api.deepseek.com/v1/chat/completions', data=body,
                                         headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=120) as r:
                d = json.loads(r.read())
            return json.loads(d['choices'][0]['message']['content'])
        except Exception as e:
            if a == retries - 1:
                return {'error': str(e)[:200]}
            time.sleep(2 * (a + 1))

SYS = ('你是公务员考试常识/知识题解题专家。独立作答下面的选择题（不要参考任何给定答案），'
       '然后写一段最终解析。解析要求：≤90字，说明正确项的知识依据，可顺带点出主要干扰项为何错误；'
       '必须是可直接展示给考生的成品解析文本，禁止出现"解析应/建议/应改为"等元评论。\n'
       '输出 JSON：{"answer":"A|B|C|D","explanation":"..."}')

audit = {}
for l in open(os.path.join(OUT, 'llm_orig_audit.jsonl')):
    d = json.loads(l)
    audit[d['id']] = d
items = []
for qid, d in audit.items():
    if d.get('verdict') != 'fix':
        continue
    row = conn.execute("SELECT question, options, answer FROM questions WHERE id=?", (qid,)).fetchone()
    if not row:
        continue
    try:
        old = json.loads(row['options'] or '{}')
    except Exception:
        continue
    a = (row['answer'] or '').strip().upper()
    newo = d.get('options')
    use_new = (isinstance(newo, dict) and set(newo) == set(old) and a in newo
               and str(newo[a]).strip() == str(old.get(a, '')).strip() and newo != old)
    items.append({'id': qid, 'question': row['question'], 'answer': a,
                  'old_options': old, 'new_options': newo if use_new else None})

path = os.path.join(OUT, 'llm_orig_refine.jsonl')
done = set()
if os.path.exists(path):
    for l in open(path):
        try: done.add(json.loads(l)['id'])
        except Exception: pass
items = [it for it in items if it['id'] not in done]
print(len(items), 'to refine')
f = open(path, 'a', encoding='utf-8')
cnt = [0]

def fmt(o):
    return ' '.join(f"{k}.{v}" for k, v in sorted(o.items()))

def go(it):
    res = {'id': it['id']}
    opts = it['new_options'] or it['old_options']
    r1 = llm(SYS, f"题目：{it['question']}\n选项：{fmt(opts)}")
    if r1.get('error'):
        res.update(verdict='error', error=r1['error'])
    elif (r1.get('answer') or '').strip().upper() == it['answer']:
        res.update(verdict='fix', explanation=(r1.get('explanation') or '').strip(),
                   options=it['new_options'], solved=it['answer'])
    else:
        if it['new_options']:
            r2 = llm(SYS, f"题目：{it['question']}\n选项：{fmt(it['old_options'])}")
            if (r2.get('answer') or '').strip().upper() == it['answer']:
                res.update(verdict='fix', explanation=(r2.get('explanation') or '').strip(),
                           options=None, solved=it['answer'], note='new options rejected (solver disagreed)')
            else:
                res.update(verdict='delist', reason=f"独立作答 {r2.get('answer')} ≠ 标注 {it['answer']}，疑似答案错误")
        else:
            res.update(verdict='delist', reason=f"独立作答 {r1.get('answer')} ≠ 标注 {it['answer']}，疑似答案错误")
    with lock:
        f.write(json.dumps(res, ensure_ascii=False) + '\n'); f.flush()
        cnt[0] += 1
        if cnt[0] % 200 == 0:
            print(cnt[0], flush=True)

with ThreadPoolExecutor(48) as ex:
    list(ex.map(go, items))
f.close()
print('done')
