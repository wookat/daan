#!/usr/bin/env python3
"""汇总 out/*.jsonl → data/iter-r3/{ledger.jsonl,fixes.sql,summary.json}。
同一 id 多条记录取最后一条（重试覆盖）。"""
import json, os, sqlite3

OUT = os.environ.get('OUTDIR', '/home/ubuntu/r3/out')
DEST = os.environ.get('DEST', '/home/ubuntu/repos/kaogong-assistant/data/iter-r3')
DB = os.environ.get('SNAP', '/home/ubuntu/r3/snap_r3.db')


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
sql.write('-- iter-r3 fixes: T1 泄漏残余干扰项均衡（options）、T2 模板题干改写（question）\nBEGIN;\n')
summary = {}

# T1
t1 = last_by_id(os.path.join(OUT, 't1_leak2.jsonl'))
n_fix = n_keep = 0
sql.write('-- T1: 轮2 T2a keep 残余泄漏题干扰项均衡\n')
for qid in sorted(t1):
    r = t1[qid]
    if 'options' in r:
        n_fix += 1
        opts = json.dumps(r['options'], ensure_ascii=False)
        sql.write(f"UPDATE questions SET options='{esc(opts)}' WHERE id={qid};\n")
        ledger.write(json.dumps({'task': 'T1', 'id': qid, 'action': 'fix',
                                 'new_options': r['options'], 'attempts': r.get('attempts'),
                                 'method': 'llm(deepseek)带反馈重试+程序校验(键集/正确项不变/不泄漏/长度带宽)'},
                                ensure_ascii=False) + '\n')
    else:
        n_keep += 1
        ledger.write(json.dumps({'task': 'T1', 'id': qid, 'action': 'keep',
                                 'reason': f"三轮带反馈改写仍未过校验：{r.get('skip')}"
                                 if r.get('skip') not in ('no longer leaky',)
                                 else '快照中已不泄漏，无需处理',
                                 'method': 'llm(deepseek)'}, ensure_ascii=False) + '\n')
summary['t1'] = {'targets': len(t1), 'fix': n_fix, 'keep': n_keep}

# T2
t2 = last_by_id(os.path.join(OUT, 't2_stem_full.jsonl'))
n_fix = n_keep = 0
sql.write('-- T2: 模板化题干（…之X是）改写为自然问法\n')
for qid in sorted(t2):
    r = t2[qid]
    if 'question' in r:
        n_fix += 1
        sql.write(f"UPDATE questions SET question='{esc(r['question'])}' WHERE id={qid};\n")
        ledger.write(json.dumps({'task': 'T2', 'id': qid, 'action': 'fix',
                                 'new_question': r['question'],
                                 'method': 'llm(deepseek)改写+独立作答二审+查重'},
                                ensure_ascii=False) + '\n')
    else:
        n_keep += 1
        ledger.write(json.dumps({'task': 'T2', 'id': qid, 'action': 'keep',
                                 'reason': f"改写未通过校验：{r.get('skip')}",
                                 'method': 'llm(deepseek)'}, ensure_ascii=False) + '\n')
summary['t2'] = {'targets': len(t2), 'fix': n_fix, 'keep': n_keep}

sql.write('COMMIT;\n')
sql.close()
ledger.close()

# T3 样例（不入库，仅归档）
t3p = os.path.join(OUT, 't3_samples.jsonl')
n_pass = n_rej = 0
if os.path.exists(t3p):
    with open(os.path.join(DEST, 't3-samples.jsonl'), 'w', encoding='utf-8') as g:
        for l in open(t3p):
            d = json.loads(l)
            n_pass += 'reject' not in d
            n_rej += 'reject' in d
            g.write(l)
summary['t3'] = {'samples_pass': n_pass, 'samples_reject': n_rej}

json.dump(summary, open(os.path.join(DEST, 'summary.json'), 'w'), ensure_ascii=False, indent=1)
print(summary)
