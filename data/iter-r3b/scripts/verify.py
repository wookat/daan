#!/usr/bin/env python3
"""iter-r3b 校验：在快照副本上执行 fixes.sql + delist.sql 后逐项复核。
用法：SNAP=快照 COPY=副本 REPO=仓库根 python3 verify.py"""
import json, os, re, shutil, sqlite3, sys

SNAP = os.environ.get('SNAP', '/home/ubuntu/r3/snap_r3b.db')
COPY = os.environ.get('COPY', '/home/ubuntu/r3/verify_copy_r3b.db')
REPO = os.environ.get('REPO', '/home/ubuntu/repos/kaogong-assistant')
DEST = os.path.join(REPO, 'data/iter-r3b')

if not os.path.exists(COPY):
    shutil.copy(SNAP, COPY)
    con = sqlite3.connect(COPY)
    con.executescript(open(os.path.join(DEST, 'fixes.sql')).read())
    con.executescript(open(os.path.join(DEST, 'delist.sql')).read())
    con.commit()
    con.close()
    print('applied fixes.sql + delist.sql to copy')

new = sqlite3.connect(COPY)
new.row_factory = sqlite3.Row
old = sqlite3.connect(SNAP)
old.row_factory = sqlite3.Row
fails = []


def uniq_longest(opts):
    lens = sorted(((len(str(v)), k) for k, v in opts.items()), reverse=True)
    if len(lens) < 2 or lens[0][0] == lens[1][0]:
        return None
    return lens[0][1]


ledger = [json.loads(l) for l in open(os.path.join(DEST, 'ledger.jsonl'))]
t1 = [d for d in ledger if d['task'] == 'T1']
t2 = [d for d in ledger if d['task'] == 'T2']

# 1. T1 fix：键集不变、正确项逐字不变、非唯一最长、长度带宽、DB==ledger
bad = 0
for d in t1:
    if d['action'] != 'fix':
        continue
    ro = old.execute('SELECT options, answer FROM questions WHERE id=?', (d['id'],)).fetchone()
    rn = new.execute('SELECT options FROM questions WHERE id=?', (d['id'],)).fetchone()
    o, n = json.loads(ro['options']), json.loads(rn['options'])
    a = (ro['answer'] or '').strip().upper()
    lens = [len(str(v)) for v in n.values()]
    if (n != d['new_options'] or set(o) != set(n) or str(n[a]).strip() != str(o[a]).strip()
            or uniq_longest(n) == a or max(lens) > 3 * min(lens)):
        bad += 1
print(('PASS' if not bad else 'FAIL') + f' T1 fixes valid: bad={bad}')
if bad:
    fails.append('t1 fixes')

# 2. T1 目标：全库 original 在架泄漏率（唯一最长==正确项）各模块 ≤35%
rates = {}
D = {}
L = {}
for r in new.execute("SELECT module, options, answer FROM questions WHERE disabled=0 AND source='original'"):
    try:
        opts = json.loads(r['options'])
    except Exception:
        continue
    a = (r['answer'] or '').strip().upper()
    if a not in opts or len(opts) < 2 or uniq_longest(opts) is None:
        continue
    D[r['module']] = D.get(r['module'], 0) + 1
    if uniq_longest(opts) == a:
        L[r['module']] = L.get(r['module'], 0) + 1
over = []
for m in sorted(D):
    rate = L.get(m, 0) / D[m] * 100
    rates[m] = rate
    print(f'  original {m}: {L.get(m,0)}/{D[m]} = {rate:.1f}%')
    if rate > 35:
        over.append(m)
tot_d, tot_l = sum(D.values()), sum(L.values())
print(f'  original ALL: {tot_l}/{tot_d} = {tot_l/tot_d*100:.1f}%')
print(('PASS' if not over and tot_l / tot_d <= 0.35 else 'FAIL') + f' T1 leak target ≤35%: over={over}')
if over or tot_l / tot_d > 0.35:
    fails.append('t1 target')

# 3. T2 覆盖：快照中在架 之_是 题全部有决策
targets = {r['id'] for r in old.execute("SELECT id FROM questions WHERE disabled=0 AND question LIKE '%之_是%'")}
t2ids = {d['id'] for d in t2}
missing = targets - t2ids
print(('PASS' if not missing else 'FAIL') + f' T2 coverage: {len(t2ids)}/{len(targets)} missing={len(missing)}')
if missing:
    fails.append('t2 coverage')

# 4. T2 fix/delist：DB==ledger、fix 不再命中 之_是、全库无新增重复；delist 已下架
pat = re.compile(r'之.是')
bad = 0
for d in t2:
    rn = new.execute('SELECT question, disabled FROM questions WHERE id=?', (d['id'],)).fetchone()
    if d['action'] == 'fix':
        if rn['question'] != d['new_question'] or pat.search(rn['question']) or not (10 <= len(rn['question']) <= 80):
            bad += 1
    elif d['action'] == 'delist':
        if rn['disabled'] != 1:
            bad += 1
dups = new.execute('SELECT COUNT(*) c FROM (SELECT question FROM questions GROUP BY question HAVING COUNT(*)>1)').fetchone()['c']
dups_old = old.execute('SELECT COUNT(*) c FROM (SELECT question FROM questions GROUP BY question HAVING COUNT(*)>1)').fetchone()['c']
print(('PASS' if not bad and dups <= dups_old else 'FAIL') + f' T2 rows valid: bad={bad} dup_groups new={dups} old={dups_old}')
if bad or dups > dups_old:
    fails.append('t2 rows')

# 5. 之_是 残留 = keep（自然句式/真题保守）数
res = new.execute("SELECT COUNT(*) c FROM questions WHERE disabled=0 AND question LIKE '%之_是%'").fetchone()['c']
keeps = sum(1 for d in t2 if d['action'] == 'keep')
print(('PASS' if res <= keeps else 'FAIL') + f' 之_是 remaining={res} (keeps={keeps})')
if res > keeps:
    fails.append('t2 residual')

print('RESULT:', 'ALL PASS' if not fails else 'FAILED ' + ','.join(fails))
sys.exit(1 if fails else 0)
