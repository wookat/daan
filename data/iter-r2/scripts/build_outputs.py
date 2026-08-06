#!/usr/bin/env python3
"""汇总三条治理线，产出 data/iter-r2/{ledger.jsonl,fixes.sql,delist.sql}。

顺序：T1 数量解析重写（fix/delist）→ T2a 干扰项长度均衡 → T2b 模板题干抽样重写
→ T3 答案位置偏置重排（source='original' 在架题子集，剔除本轮下架题，基于 T1/T2 后的最终文本计算）。
"""
import json, os, random, re, sqlite3

DB = os.environ.get('SNAP', '/home/ubuntu/r2b/snap_r2.db')
OUT = os.environ.get('OUTDIR', '/home/ubuntu/r2b/out')
DEST = os.environ.get('DEST', '/home/ubuntu/r2b/dist')
os.makedirs(DEST, exist_ok=True)

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row


def esc(s):
    return "'" + str(s).replace("'", "''") + "'"


def load(fn):
    p = os.path.join(OUT, fn)
    d = {}
    if os.path.exists(p):
        for l in open(p):
            try:
                r = json.loads(l)
                d[r['id']] = r
            except Exception:
                pass
    return d


ledger = open(os.path.join(DEST, 'ledger.jsonl'), 'w', encoding='utf-8')
fixes = open(os.path.join(DEST, 'fixes.sql'), 'w', encoding='utf-8')
delist = open(os.path.join(DEST, 'delist.sql'), 'w', encoding='utf-8')
fixes.write("-- iter-r2 fixes（生成于快照 snap_r2.db，生产执行前先备份）\nBEGIN;\n")
delist.write("-- iter-r2 delist\nBEGIN;\n")

# 内存态：模拟执行后的最终文本，供 T3 使用
state = {}  # id -> dict(question, options(dict), answer, explanation, source, disabled)
for r in conn.execute("SELECT id, question, options, answer, explanation, source, module, disabled FROM questions WHERE disabled=0"):
    try:
        o = json.loads(r['options'] or '{}')
    except Exception:
        o = {}
    state[r['id']] = {'question': r['question'], 'options': o, 'answer': (r['answer'] or '').strip().upper(),
                      'explanation': r['explanation'], 'source': r['source'], 'module': r['module'],
                      'disabled': 0}

META_PAT = re.compile(r'(解析应|建议|应改为|原题|本题改写|已改写)')
NUM_PAT = re.compile(r'-?\d+\.?\d*')


def opt_num(s):
    m = NUM_PAT.findall(str(s).replace(',', '').replace('%', ''))
    return float(m[0]) if m else None


def eval_expr(e):
    if not e or not isinstance(e, str) or not re.fullmatch(r'[\d\.\+\-\*\/\(\)\s%]+', e):
        return None
    try:
        return float(eval(e, {'__builtins__': {}}, {}))
    except Exception:
        return None


# ---------- T1 ----------
s1 = load('t1_stage1.jsonl')
s2 = load('t1_stage2.jsonl')
arb = load('t1_arbiter.jsonl')
t1_targets = [r['id'] for r in conn.execute(
    "SELECT id FROM questions WHERE module='shuliang' AND disabled=0 AND quality_score<50 ORDER BY id")]
t1_fix = t1_delist = t1_pyfail = 0
for qid in t1_targets:
    st = state[qid]
    lab = st['answer']
    d1, d2, da = s1.get(qid) or {}, s2.get(qid) or {}, arb.get(qid) or {}
    a1, a2, aa = d1.get('answer'), d2.get('answer'), da.get('answer')
    # 选定产出源：一审/二审均与标注一致 → 用一审解析；否则仲裁==标注 → 用仲裁解析；否则下架
    if a1 == lab and a2 == lab:
        src, expl, expr = 'stage1', (d1.get('explanation') or '').strip(), d1.get('expr')
    elif aa == lab:
        src, expl, expr = 'arbiter(grok-4.5)', (da.get('explanation') or '').strip(), da.get('expr')
    else:
        delist.write(f"UPDATE questions SET disabled=1 WHERE id={qid}; -- T1 二审不一致\n")
        ledger.write(json.dumps({'task': 'T1', 'id': qid, 'action': 'delist',
                                 'reason': f'独立作答不一致：一审{a1}/二审{a2}/仲裁{aa or "-"} vs 标注{lab}',
                                 'method': 'llm(deepseek)x2+grok-4.5仲裁'}, ensure_ascii=False) + '\n')
        st['disabled'] = 1
        t1_delist += 1
        continue
    # 程序代入验算：expr 可求值且标注选项为数值时，验算不一致且命中其他选项 → 下架
    pycheck = 'n/a'
    v = eval_expr(expr if expr not in ('null', '') else None)
    t = opt_num(st['options'].get(lab))
    if v is not None and t is not None:
        if abs(v - t) <= max(1e-6, abs(t) * 0.01):
            pycheck = 'pass'
        else:
            hit = [k for k, ov in st['options'].items()
                   if k != lab and opt_num(ov) is not None and abs(v - opt_num(ov)) <= max(1e-6, abs(opt_num(ov)) * 0.01)]
            if hit:
                delist.write(f"UPDATE questions SET disabled=1 WHERE id={qid}; -- T1 验算命中他项\n")
                ledger.write(json.dumps({'task': 'T1', 'id': qid, 'action': 'delist',
                                         'reason': f'程序验算 expr={expr} 结果 {v} 命中选项{hit[0]}≠标注{lab}',
                                         'method': 'python代入验算'}, ensure_ascii=False) + '\n')
                st['disabled'] = 1
                t1_delist += 1
                t1_pyfail += 1
                continue
            pycheck = 'inconclusive'
    HINTS = ('因此', '所以', '故选', '故答案', '综上', '第一步', '第二步', '步骤', '代入', '排除', '由题', '根据')
    if not expl or len(expl) < 20 or META_PAT.search(expl) or not any(h in expl for h in HINTS):
        # 解析不可用 → 保守下架
        delist.write(f"UPDATE questions SET disabled=1 WHERE id={qid}; -- T1 解析不可用\n")
        ledger.write(json.dumps({'task': 'T1', 'id': qid, 'action': 'delist',
                                 'reason': '改写解析为空/过短/含元评论', 'method': src}, ensure_ascii=False) + '\n')
        st['disabled'] = 1
        t1_delist += 1
        continue
    fixes.write(f"UPDATE questions SET explanation={esc(expl)} WHERE id={qid}; -- T1\n")
    ledger.write(json.dumps({'task': 'T1', 'id': qid, 'action': 'fix', 'new_explanation': expl,
                             'pycheck': pycheck, 'expr': expr,
                             'method': f'llm改写[{src}]+独立作答二审+python验算'}, ensure_ascii=False) + '\n')
    st['explanation'] = expl
    t1_fix += 1
print(f'T1: targets={len(t1_targets)} fix={t1_fix} delist={t1_delist} (pyfail={t1_pyfail})')

# ---------- T2a ----------
t2a = load('t2_leak.jsonl')
t2a_fix = t2a_skip = 0
for qid, d in sorted(t2a.items()):
    st = state.get(qid)
    if st is None or st['disabled']:
        continue
    if 'options' not in d:
        ledger.write(json.dumps({'task': 'T2a', 'id': qid, 'action': 'keep',
                                 'reason': f"改写未过校验：{d.get('skip')}", 'method': 'llm(deepseek)'},
                                ensure_ascii=False) + '\n')
        t2a_skip += 1
        continue
    new = d['options']
    fixes.write(f"UPDATE questions SET options={esc(json.dumps(new, ensure_ascii=False))} WHERE id={qid}; -- T2a\n")
    ledger.write(json.dumps({'task': 'T2a', 'id': qid, 'action': 'fix', 'new_options': new,
                             'reason': '正确项长度泄漏，干扰项扩写均衡（正确项未动）',
                             'method': 'llm(deepseek)+程序校验'}, ensure_ascii=False) + '\n')
    st['options'] = new
    t2a_fix += 1
print(f'T2a: fix={t2a_fix} keep(skip)={t2a_skip}')

# ---------- T2b ----------
t2b = load('t2_stem.jsonl')
seen_q = {v['question'] for v in state.values()}
t2b_fix = t2b_skip = 0
for qid, d in sorted(t2b.items()):
    st = state.get(qid)
    if st is None or st['disabled']:
        continue
    nq = d.get('question')
    if not nq or nq in seen_q:
        ledger.write(json.dumps({'task': 'T2b', 'id': qid, 'action': 'keep',
                                 'reason': f"改写未过校验：{d.get('skip', '题干重复')}",
                                 'method': 'llm(deepseek)'}, ensure_ascii=False) + '\n')
        t2b_skip += 1
        continue
    fixes.write(f"UPDATE questions SET question={esc(nq)} WHERE id={qid}; -- T2b\n")
    ledger.write(json.dumps({'task': 'T2b', 'id': qid, 'action': 'fix', 'new_question': nq,
                             'reason': '模板化题干重写为自然问句（抽样，独立作答校验通过）',
                             'method': 'llm(deepseek)改写+独立作答校验'}, ensure_ascii=False) + '\n')
    seen_q.add(nq)
    st['question'] = nq
    t2b_fix += 1
print(f'T2b: fix={t2b_fix} keep(skip)={t2b_skip}')

# ---------- T3 ----------
LET = ['A', 'B', 'C', 'D']
def gx_consistent(st):
    m = re.search(r'故选\s*([ABCD])', st['explanation'] or '')
    return m is None or m.group(1) == st['answer']


elig = [qid for qid, st in state.items()
        if not st['disabled'] and st['source'] == 'original' and st['answer'] in LET
        and set(st['options'].keys()) == set(LET)
        and len({str(v).strip() for v in st['options'].values()}) == 4
        and gx_consistent(st)]
from collections import Counter
before = Counter(state[q]['answer'] for q in elig)
n = len(elig)
target = {L: n // 4 + (1 if i < n % 4 else 0) for i, L in enumerate(LET)}
rng = random.Random(4242)
by_letter = {L: [q for q in elig if state[q]['answer'] == L] for L in LET}
for L in LET:
    rng.shuffle(by_letter[L])
moves = []  # (qid, from, to)
surplus = []
for L in LET:
    extra = len(by_letter[L]) - target[L]
    if extra > 0:
        surplus.extend((q, L) for q in by_letter[L][:extra])
rng.shuffle(surplus)
need = {L: target[L] - len(by_letter[L]) for L in LET if len(by_letter[L]) < target[L]}
for L, k in sorted(need.items()):
    for q, frm in surplus[:k]:
        moves.append((q, frm, L))
    surplus = surplus[k:]

LETTER_REF = re.compile(r'(?<![A-Za-z0-9])([ABCD])(?![A-Za-z0-9])')
t3_fix = 0
for qid, frm, to in moves:
    st = state[qid]
    o = dict(st['options'])
    o[frm], o[to] = o[to], o[frm]
    expl = st['explanation'] or ''

    def sub(m):
        c = m.group(1)
        return to if c == frm else (frm if c == to else c)

    new_expl = LETTER_REF.sub(sub, expl)
    fixes.write(f"UPDATE questions SET options={esc(json.dumps(o, ensure_ascii=False))}, "
                f"answer='{to}', explanation={esc(new_expl)} WHERE id={qid}; -- T3 {frm}->{to}\n")
    ledger.write(json.dumps({'task': 'T3', 'id': qid, 'action': 'fix',
                             'reason': f'答案位置偏置重排：{frm}->{to}（选项内容与解析字母引用同步轮转）',
                             'move': [frm, to], 'method': 'rule(seed=4242)'}, ensure_ascii=False) + '\n')
    st['options'], st['answer'], st['explanation'] = o, to, new_expl
    t3_fix += 1
after = Counter(state[q]['answer'] for q in elig)
print(f'T3: eligible={n} moved={t3_fix}')
print('  before', dict(before))
print('  after ', dict(after))

fixes.write('COMMIT;\n')
delist.write('COMMIT;\n')
for f in (ledger, fixes, delist):
    f.close()
json.dump({'t1': {'targets': len(t1_targets), 'fix': t1_fix, 'delist': t1_delist},
           't2a': {'fix': t2a_fix, 'skip': t2a_skip}, 't2b': {'fix': t2b_fix, 'skip': t2b_skip},
           't3': {'eligible': n, 'moved': t3_fix, 'before': dict(before), 'after': dict(after)}},
          open(os.path.join(DEST, 'summary.json'), 'w'), ensure_ascii=False, indent=1)
print('written to', DEST)
