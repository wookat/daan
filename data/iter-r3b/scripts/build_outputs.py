#!/usr/bin/env python3
"""汇总 out3b/*.jsonl → data/iter-r3b/{ledger.jsonl,fixes.sql,delist.sql,summary.json}。"""
import json, os

OUT = os.environ.get('OUTDIR', '/home/ubuntu/r3/out3b')
DEST = os.environ.get('DEST', '/home/ubuntu/repos/kaogong-assistant/data/iter-r3b')


def esc(s):
    return str(s).replace("'", "''")


def last_by_id(path):
    d = {}
    if os.path.exists(path):
        for l in open(path):
            try:
                r = json.loads(l)
                d[r['id']] = r
            except Exception:
                pass
    return d


ledger = open(os.path.join(DEST, 'ledger.jsonl'), 'w', encoding='utf-8')
sql = open(os.path.join(DEST, 'fixes.sql'), 'w', encoding='utf-8')
dsql = open(os.path.join(DEST, 'delist.sql'), 'w', encoding='utf-8')
sql.write('-- iter-r3b fixes: T1 全库original干扰项长度均衡（options）、T2 之_是残留题干改写（question）\nBEGIN;\n')
dsql.write('-- iter-r3b delist: T2 之_是病句且改写未通过的 original 自产题\nBEGIN;\n')
summary = {}

t1 = last_by_id(os.path.join(OUT, 't1b.jsonl'))
n_fix = n_keep = 0
sql.write('-- T1\n')
for qid in sorted(t1):
    r = t1[qid]
    if 'options' in r:
        n_fix += 1
        opts = json.dumps(r['options'], ensure_ascii=False)
        sql.write(f"UPDATE questions SET options='{esc(opts)}' WHERE id={qid};\n")
        ledger.write(json.dumps({'task': 'T1', 'id': qid, 'action': 'fix',
                                 'new_options': r['options'], 'attempts': r.get('attempts'),
                                 'method': 'llm(deepseek)带反馈重试+程序校验(键集/正确项不变/非唯一最长/长度带宽)'},
                                ensure_ascii=False) + '\n')
    else:
        n_keep += 1
        ledger.write(json.dumps({'task': 'T1', 'id': qid, 'action': 'keep',
                                 'reason': f"三轮带反馈改写仍未过校验：{r.get('skip')}",
                                 'method': 'llm(deepseek)'}, ensure_ascii=False) + '\n')
summary['t1'] = {'targets': len(t1), 'fix': n_fix, 'keep': n_keep}

t2 = last_by_id(os.path.join(OUT, 't2b.jsonl'))
n_fix = n_keep = n_del = 0
sql.write('-- T2\n')
for qid in sorted(t2):
    r = t2[qid]
    if r['action'] == 'fix':
        n_fix += 1
        sql.write(f"UPDATE questions SET question='{esc(r['question'])}' WHERE id={qid};\n")
        ledger.write(json.dumps({'task': 'T2', 'id': qid, 'action': 'fix',
                                 'new_question': r['question'],
                                 'method': 'llm(deepseek)判病句+结合解析改写+查重+独立作答二审'},
                                ensure_ascii=False) + '\n')
    elif r['action'] == 'delist':
        n_del += 1
        dsql.write(f"UPDATE questions SET disabled=1 WHERE id={qid}; -- {esc(r['reason'])}\n")
        ledger.write(json.dumps({'task': 'T2', 'id': qid, 'action': 'delist',
                                 'reason': r['reason'], 'method': 'llm(deepseek)'},
                                ensure_ascii=False) + '\n')
    else:
        n_keep += 1
        ledger.write(json.dumps({'task': 'T2', 'id': qid, 'action': 'keep',
                                 'reason': r['reason'], 'method': 'llm(deepseek)'},
                                ensure_ascii=False) + '\n')
summary['t2'] = {'targets': len(t2), 'fix': n_fix, 'keep': n_keep, 'delist': n_del}

sql.write('COMMIT;\n')
dsql.write('COMMIT;\n')
sql.close()
dsql.close()
ledger.close()
json.dump(summary, open(os.path.join(DEST, 'summary.json'), 'w'), ensure_ascii=False, indent=1)
print(summary)
