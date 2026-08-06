#!/usr/bin/env python3
"""iter-r3 校验：在快照副本上执行 fixes.sql 后逐项复核。
用法：SNAP=快照 COPY=副本路径 REPO=仓库根 python3 verify.py
（副本不存在时自动从 SNAP 复制并执行 fixes.sql）"""
import json, os, re, shutil, sqlite3, sys

SNAP = os.environ.get('SNAP', '/home/ubuntu/r3/snap_r3.db')
COPY = os.environ.get('COPY', '/home/ubuntu/r3/verify_copy.db')
REPO = os.environ.get('REPO', '/home/ubuntu/repos/kaogong-assistant')
DEST = os.path.join(REPO, 'data/iter-r3')

if not os.path.exists(COPY):
    shutil.copy(SNAP, COPY)
    con = sqlite3.connect(COPY)
    con.executescript(open(os.path.join(DEST, 'fixes.sql')).read())
    con.commit()
    con.close()
    print('applied fixes.sql to copy')

new = sqlite3.connect(COPY)
new.row_factory = sqlite3.Row
old = sqlite3.connect(SNAP)
old.row_factory = sqlite3.Row
fails = []


def leaky(opts, ans):
    lens = sorted(((len(str(v)), k) for k, v in opts.items()), reverse=True)
    return lens[0][1] == ans and len(lens) > 1 and lens[0][0] >= 1.5 * lens[1][0]


ledger = [json.loads(l) for l in open(os.path.join(DEST, 'ledger.jsonl'))]
t1 = [d for d in ledger if d['task'] == 'T1']
t2 = [d for d in ledger if d['task'] == 'T2']

# 1. T1 覆盖：轮2 T2a keep 的题全部有决策
r2keep = {json.loads(l)['id'] for l in open(os.path.join(REPO, 'data/iter-r2/ledger.jsonl'))
          if '"T2a"' in l and '"keep"' in l}
t1ids = {d['id'] for d in t1}
missing = r2keep - t1ids - {d['id'] for d in ledger}  # 下架题不在 targets
# 允许快照中已下架的 keep 题缺席
for qid in list(missing):
    r = old.execute('SELECT disabled FROM questions WHERE id=?', (qid,)).fetchone()
    if r and r['disabled']:
        missing.discard(qid)
print(('PASS' if not missing else 'FAIL') + f' T1 coverage: {len(t1ids)}/{len(r2keep)} missing={len(missing)}')
if missing:
    fails.append('t1 coverage')

# 2. T1 fix：键集不变、正确项逐字不变、改后不泄漏、长度带宽、DB==ledger
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
            or leaky(n, a) or max(lens) > 3 * min(lens)):
        bad += 1
print(('PASS' if not bad else 'FAIL') + f' T1 fixes valid: bad={bad}')
if bad:
    fails.append('t1 fixes')

# 3. T2 fix：DB==ledger、不再命中模板正则、长度、全库唯一
pat = re.compile(r'之[\u4e00-\u9fa5]{1,4}是[:：]?$')
bad = 0
for d in t2:
    if d['action'] != 'fix':
        continue
    rn = new.execute('SELECT question FROM questions WHERE id=?', (d['id'],)).fetchone()
    if rn['question'] != d['new_question'] or pat.search(rn['question'].strip()) \
            or not (10 <= len(rn['question']) <= 80):
        bad += 1
dups = new.execute('SELECT COUNT(*) c FROM (SELECT question FROM questions GROUP BY question HAVING COUNT(*)>1)').fetchone()['c']
dups_old = old.execute('SELECT COUNT(*) c FROM (SELECT question FROM questions GROUP BY question HAVING COUNT(*)>1)').fetchone()['c']
print(('PASS' if not bad and dups <= dups_old else 'FAIL') +
      f' T2 fixes valid: bad={bad} dup_groups new={dups} old={dups_old}')
if bad or dups > dups_old:
    fails.append('t2 fixes')

# 4. 泄漏率复核：轮1 T2 改写在架题正确项最长(≥1.5×)占比
t2fix_r1 = {json.loads(l)['id'] for l in open(os.path.join(REPO, 'data/iter-r1/ledger.jsonl'))
            if '"T2"' in l and '"fix"' in l}
tot = lk = 0
for r in new.execute('SELECT id, options, answer FROM questions WHERE disabled=0'):
    if r['id'] not in t2fix_r1:
        continue
    try:
        opts = json.loads(r['options'])
    except Exception:
        continue
    a = (r['answer'] or '').strip().upper()
    if a in opts:
        tot += 1
        lk += leaky(opts, a)
print(f'INFO leak rate after fixes: {lk}/{tot} = {lk/tot*100:.1f}%')

# 5. 模板题干残余
res = 0
for r in new.execute("SELECT id, question FROM questions WHERE disabled=0"):
    if r['id'] in t2fix_r1 and pat.search((r['question'] or '').strip()):
        res += 1
print(f'INFO template stems remaining (r1-T2-fix scope): {res}')

print('RESULT:', 'ALL PASS' if not fails else 'FAILED ' + ','.join(fails))
sys.exit(1 if fails else 0)
