#!/usr/bin/env python3
"""一致性校验：把 fixes.sql + delist.sql 应用到快照副本，对照 ledger 与治理目标逐项验证。"""
import sqlite3, json, re, os, shutil, sys, collections

SNAP = '/home/ubuntu/snap_iter.db'
WORK = '/home/ubuntu/work/snap_patched.db'
DEST = os.environ.get('DEST', '/home/ubuntu/repos/kaogong-assistant/data/iter-r1')

shutil.copy(SNAP, WORK)
conn = sqlite3.connect(WORK)
for f in ('fixes.sql', 'delist.sql'):
    sql = open(os.path.join(DEST, f)).read()
    conn.executescript(sql.replace('BEGIN;', '').replace('COMMIT;', ''))
    conn.commit()
    print(f, 'applied')

led = collections.Counter()
delist_ids, fix_ids = set(), set()
for l in open(os.path.join(DEST, 'ledger.jsonl')):
    d = json.loads(l)
    led[(d['task'], d['action'])] += 1
    if d['action'] == 'delist' and d.get('table', 'questions') == 'questions' and isinstance(d.get('id'), int):
        delist_ids.add(d['id'])
print('\nledger 计数：')
for k, v in sorted(led.items()):
    print(' ', k, v)

c = conn.cursor()
ok = True
def check(name, cond, detail=''):
    global ok
    print(('PASS' if cond else 'FAIL'), name, detail)
    if not cond:
        ok = False

# 1) 下架一致
n = c.execute(f"SELECT count(*) FROM questions WHERE id IN ({','.join(map(str,delist_ids))}) AND disabled=1").fetchone()[0]
check('delist 全部生效', n == len(delist_ids), f'{n}/{len(delist_ids)}')

# 2) 页码残留清零（在架）
pg = re.compile(r'[-－—]\s+\d{1,3}\s+[-－—]')
res = [r for r in c.execute("SELECT id, explanation, question FROM questions WHERE disabled=0")
       if pg.search(r[1] or '') or pg.search(r[2] or '')]
check('在架页码残留清零', len(res) == 0, str([r[0] for r in res[:5]]))

# 3) 嵌套 ASCII 引号清零（在架，排除 UNIQUE 碰撞而有意保留的 skip 题）
skip_ids = set()
for l in open(os.path.join(DEST, 'ledger.jsonl')):
    d = json.loads(l)
    if d.get('action') == 'skip' or 'DUP_COLLISION_KEEP_QUESTION' in (d.get('tags') or []):
        if isinstance(d.get('id'), int):
            skip_ids.add(d['id'])
rows = c.execute("SELECT id FROM questions WHERE disabled=0 AND (question LIKE '%“''%' OR question LIKE '%''”%')").fetchall()
resid = [r[0] for r in rows if r[0] not in skip_ids]
check('嵌套 ASCII 引号清零（除碰撞保留）', len(resid) == 0, str(resid[:5]))

# 4) 同义 submodule 清零
MERGED = {'changshi': ['公文', '应急', '地理', '环保', '环境', '婚家', '消保', '个人信息', '未保', '科技常识', '科技-物理', '物理', '网安', '道交'],
          'shuliang': ['钟表问题', '牛吃草问题', '抽屉原理', '最不利原则', '和倍问题', '还原问题', '平均数问题', '不定方程', '盈亏问题',
                       '植树问题', '方阵问题', '数列问题', '爬楼问题', '鸡兔同笼', '锯木问题', '敲钟问题', '队列问题', '构造类问题', '数字推理-多重数列',
                       '逻辑判断', '分析推理', '经济', '增长率', '基期量', '简单计算']}
bad = 0
for mod, subs in MERGED.items():
    for s in subs:
        bad += c.execute("SELECT count(*) FROM questions WHERE module=? AND submodule=?", (mod, s)).fetchone()[0]
check('同义/错模块 submodule 清零', bad == 0, str(bad))

# 5) submodule 空值下降
for mod in ('changshi', 'shuliang'):
    n = c.execute("SELECT count(*) FROM questions WHERE disabled=0 AND module=? AND (submodule IS NULL OR trim(submodule)='')", (mod,)).fetchone()[0]
    print(f'  {mod} 在架 submodule 空值残余: {n}')

# 6) mistakes 回填
n = c.execute("SELECT count(*) FROM mistakes WHERE question_id IS NULL OR question_id=''").fetchone()[0]
check('mistakes.question_id 缺失清零', n == 0, str(n))
# 回填 id 有效性
n = c.execute("SELECT count(*) FROM mistakes m LEFT JOIN questions q ON q.id=m.question_id WHERE m.question_id IS NOT NULL AND q.id IS NULL").fetchone()[0]
check('mistakes.question_id 全部指向存在的题', n == 0, str(n))

# 7) source 原始路径清理
n = c.execute("SELECT count(*) FROM questions WHERE source LIKE '%github%' OR source LIKE '%.pdf%'").fetchone()[0]
check('source GitHub/PDF 路径清零', n == 0, str(n))

# 8) fixes 未触碰下架题的文本（抽查：delist id 的 explanation 与快照一致）
snap = sqlite3.connect(SNAP)
diff = 0
for qid in list(delist_ids)[:200]:
    a = c.execute("SELECT explanation FROM questions WHERE id=?", (qid,)).fetchone()
    b = snap.execute("SELECT explanation FROM questions WHERE id=?", (qid,)).fetchone()
    if a and b and a[0] != b[0]:
        diff += 1
check('下架题文本未被重写', diff == 0, str(diff))

# 9) 打分改善预估（对照重打分）
sys.path.insert(0, '/home/ubuntu/repos/kaogong-assistant/backend')
os.environ['DB_PATH'] = WORK
conn.row_factory = sqlite3.Row
from app import quality  # noqa
stats = quality.score_all(conn)
print('rescored', stats['n'])
for mod in ('changshi', 'shuliang'):
    for db, name in ((snap, '前'), (conn, '后')):
        n = db.execute("SELECT count(*) FROM questions WHERE disabled=0 AND module=? AND quality_score<50", (mod,)).fetchone()[0]
        tot = db.execute("SELECT count(*) FROM questions WHERE disabled=0 AND module=?", (mod,)).fetchone()[0]
        print(f'  {mod} <50分（{name}）: {n}/{tot}')
print('\nRESULT:', 'ALL PASS' if ok else 'HAS FAILURES')
