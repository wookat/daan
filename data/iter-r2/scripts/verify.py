#!/usr/bin/env python3
"""一致性校验：在快照副本上执行 fixes.sql + delist.sql 后运行。
用法：SNAP=snap_r2.db DEST=data/iter-r2 COPY=copy.db python3 verify.py
（COPY 为已执行两份 SQL 的快照副本）"""
import json, os, re, sqlite3, sys
from collections import Counter

SNAP = os.environ.get('SNAP', '/home/ubuntu/r2b/snap_r2.db')
COPY = os.environ.get('COPY', '/home/ubuntu/r2b/copy.db')
DEST = os.environ.get('DEST', '/home/ubuntu/r2b/dist')

snap = sqlite3.connect(SNAP)
snap.row_factory = sqlite3.Row
cp = sqlite3.connect(COPY)
cp.row_factory = sqlite3.Row
fails = []


def check(name, cond, detail=''):
    print(('PASS' if cond else 'FAIL'), name, detail)
    if not cond:
        fails.append(name)


led = [json.loads(l) for l in open(os.path.join(DEST, 'ledger.jsonl'))]
by = {}
for d in led:
    by.setdefault(d['task'], []).append(d)

# 1) T1 覆盖率：目标簇每题都有决策
t1_ids = {r['id'] for r in snap.execute(
    "SELECT id FROM questions WHERE module='shuliang' AND disabled=0 AND quality_score<50")}
t1_led = {d['id'] for d in by.get('T1', [])}
check('T1 目标簇全覆盖', t1_ids == t1_led, f'targets={len(t1_ids)} ledger={len(t1_led)}')

# 2) T1 fix：副本解析==ledger；delist：副本 disabled=1
bad = 0
for d in by.get('T1', []):
    r = cp.execute("SELECT explanation, disabled FROM questions WHERE id=?", (d['id'],)).fetchone()
    if d['action'] == 'fix':
        # T3 可能后续改写字母引用，允许字母差异之外完全一致
        ok = r['disabled'] == 0 and len(r['explanation'] or '') >= 20
        exp = d['new_explanation']
        ok = ok and (r['explanation'] == exp or
                     re.sub(r'[ABCD]', '#', r['explanation']) == re.sub(r'[ABCD]', '#', exp))
    else:
        ok = r['disabled'] == 1
    bad += 0 if ok else 1
check('T1 ledger↔副本一致', bad == 0, f'bad={bad}')

# 3) T1 fix 解析质量：长度/结构词/无元评论
meta = re.compile(r'(解析应|建议|应改为|原题|本题改写|已改写)')
hints = ('因此', '所以', '故选', '故答案', '综上', '第一步', '第二步', '步骤', '代入', '排除', '由题', '根据')
bad = sum(1 for d in by.get('T1', []) if d['action'] == 'fix' and (
    len(d['new_explanation']) < 20 or meta.search(d['new_explanation'])
    or not any(h in d['new_explanation'] for h in hints)))
check('T1 解析质量（长度/结构/无元评论）', bad == 0, f'bad={bad}')

# 4) T2a：正确项内容未变、不再泄漏
def leaky(o, a):
    lens = sorted(((len(str(v)), k) for k, v in o.items()), reverse=True)
    return lens[0][1] == a and len(lens) > 1 and lens[0][0] >= 1.5 * lens[1][0]


bad = leak_after = 0
for d in by.get('T2a', []):
    if d['action'] != 'fix':
        continue
    s = snap.execute("SELECT options, answer FROM questions WHERE id=?", (d['id'],)).fetchone()
    c = cp.execute("SELECT options, answer FROM questions WHERE id=?", (d['id'],)).fetchone()
    so, co = json.loads(s['options']), json.loads(c['options'])
    a_snap = s['answer'].strip().upper()
    # 副本上正确项内容必须仍等于快照正确项内容（T3 可能换了字母）
    a_copy = c['answer'].strip().upper()
    ok = str(co.get(a_copy, '')).strip() == str(so.get(a_snap, '')).strip()
    if leaky(co, a_copy):
        leak_after += 1
    bad += 0 if ok else 1
check('T2a 正确项内容不变', bad == 0, f'bad={bad}')
check('T2a 改后无泄漏', leak_after == 0, f'leak_after={leak_after}')

# 5) T2b：副本题干==ledger 且唯一
bad = 0
qs = set()
for d in by.get('T2b', []):
    if d['action'] != 'fix':
        continue
    r = cp.execute("SELECT question FROM questions WHERE id=?", (d['id'],)).fetchone()
    if r['question'] != d['new_question'] or r['question'] in qs:
        bad += 1
    qs.add(r['question'])
check('T2b 题干一致且唯一', bad == 0, f'bad={bad}')

# 6) T3：选项内容集合不变、答案指向内容==原答案内容、解析故选字母==新答案
bad_perm = bad_ans = bad_ref = 0
t2a_map = {x['id']: x['new_options'] for x in by.get('T2a', []) if x['action'] == 'fix'}
for d in by.get('T3', []):
    s = snap.execute("SELECT options, answer, explanation FROM questions WHERE id=?", (d['id'],)).fetchone()
    c = cp.execute("SELECT options, answer, explanation FROM questions WHERE id=?", (d['id'],)).fetchone()
    so, co = json.loads(s['options']), json.loads(c['options'])
    frm, to = d['move']
    base = t2a_map.get(d['id']) or so
    if Counter(map(str, base.values())) != Counter(map(str, co.values())):
        bad_perm += 1
    if str(co.get(c['answer'].strip().upper(), '')).strip() != str(base.get(s['answer'].strip().upper(), '')).strip():
        bad_ans += 1
    m = re.search(r'故选\s*([ABCD])', c['explanation'] or '')
    if m and m.group(1) != c['answer'].strip().upper():
        bad_ref += 1
check('T3 选项为原内容排列', bad_perm == 0, f'bad={bad_perm}')
check('T3 新答案指向原正确内容', bad_ans == 0, f'bad={bad_ans}')
check('T3 解析故选字母与新答案一致', bad_ref == 0, f'bad={bad_ref}')

# 7) T3 后 original 在架答案分布
dist = dict(cp.execute(
    "SELECT answer, count(*) FROM questions WHERE disabled=0 AND source='original' "
    "AND answer IN ('A','B','C','D') GROUP BY answer"))
tot = sum(dist.values())
share = {k: round(v * 100.0 / tot, 1) for k, v in sorted(dist.items())}
check('T3 分布均衡（各字母 23%~27%）', all(23 <= s <= 27 for s in share.values()), str(share))

# 8) 重打分：数量低分簇消化情况
sys.path.insert(0, os.environ.get('REPO', '/home/ubuntu/repos/kaogong-assistant'))
from backend.app.quality import score_question
low = 0
for r in cp.execute("SELECT * FROM questions WHERE module='shuliang' AND disabled=0 AND quality_score<50"):
    if score_question(dict(r)) < 50:
        low += 1
print(f'INFO 数量原<50簇重打分后仍<50：{low}')

print('=' * 40)
print('ALL PASS' if not fails else f'FAILURES: {fails}')
sys.exit(1 if fails else 0)
