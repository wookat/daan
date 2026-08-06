#!/usr/bin/env python3
"""汇总确定性规则 + LLM 审查结果 → ledger.jsonl / fixes.sql / delist.sql。"""
import sqlite3, json, os, re

OUT = '/home/ubuntu/work/out'
DEST = os.environ.get('DEST', '/home/ubuntu/repos/kaogong-assistant/data/iter-r1')
os.makedirs(DEST, exist_ok=True)
conn = sqlite3.connect('/home/ubuntu/snap_iter.db'); conn.row_factory = sqlite3.Row

def esc(s):
    return (s or '').replace("'", "''")

def jl(path):
    with open(os.path.join(OUT, path)) as f:
        return [json.loads(l) for l in f if l.strip()]

L_pending = []
ledger = open(os.path.join(DEST, 'ledger.jsonl'), 'w', encoding='utf-8')
fixes = open(os.path.join(DEST, 'fixes.sql'), 'w', encoding='utf-8')
delist = open(os.path.join(DEST, 'delist.sql'), 'w', encoding='utf-8')
def L(**kw):
    ledger.write(json.dumps(kw, ensure_ascii=False) + '\n')

fixes.write("-- 迭代轮1 修复线B fixes.sql（父会话在生产库执行；执行顺序：fixes.sql → delist.sql → scripts/score_quality.py 重打分）\nBEGIN;\n")
delist.write("-- 迭代轮1 修复线B delist.sql（下架，disabled=1）\nBEGIN;\n")

delisted = set()          # 先收集所有下架 id，文本修复跳过它们
fix_expl = {}             # id -> new explanation (LLM)
fix_opts = {}             # id -> new options json (LLM)
sz_fix_opts = {}

# ---- LLM orig 审查（T2）：一审 audit + 二审 refine（独立作答校验 + 成品解析） ----
orig = {}
for r in jl('llm_orig_audit.jsonl'):
    orig[r['id']] = r   # 后写覆盖先写（去重）
refine = {}
for r in jl('llm_orig_refine.jsonl'):
    refine[r['id']] = r
META = re.compile(r'解析应|应改为|建议|元评论|题干应')
orig_delist, orig_fix, orig_ok, orig_err = [], [], 0, 0
for qid, r in orig.items():
    if r.get('error'):
        orig_err += 1; continue
    v = r.get('verdict')
    if v == 'delist':
        orig_delist.append((qid, '一审：' + r.get('reason', '')))
    elif v == 'fix':
        rf = refine.get(qid)
        if not rf or rf.get('verdict') == 'error':
            orig_ok += 1  # 二审缺失/失败：保守保持原样
            L_pending.append(qid)
            continue
        if rf['verdict'] == 'delist':
            orig_delist.append((qid, '二审：' + rf.get('reason', '')))
            continue
        newe = (rf.get('explanation') or '').strip()
        if META.search(newe) or len(newe) < 10:
            newe = ''
        newo = rf.get('options') if isinstance(rf.get('options'), dict) else None
        if newe or newo:
            orig_fix.append((qid, r.get('reason', ''), newe, newo))
        else:
            orig_ok += 1
    else:
        orig_ok += 1

# ---- T2 absurd（不可能干扰项） ----
absurd_delist, absurd_fix = [], []
for r in jl('llm_absurd_fix.jsonl'):
    if r.get('verdict') == 'delist':
        absurd_delist.append(r)
    elif r.get('verdict') == 'fix' and isinstance(r.get('options'), dict):
        tbl = r['table']
        rid = int(str(r['id']).replace('sz-', ''))
        row = conn.execute(f"SELECT options, answer FROM {tbl} WHERE id=?", (rid,)).fetchone()
        try:
            old = json.loads(row['options'] or '{}')
            a = (row['answer'] or '').strip().upper()
            if set(r['options']) == set(old) and a in r['options'] and str(r['options'][a]).strip() == str(old.get(a, '')).strip():
                absurd_fix.append(r)
        except Exception:
            pass

# ---- T1b 公式丢失 → 下架 ----
fl = jl('det_formula_loss.jsonl')

# 收集下架 id
for qid, reason in orig_delist:
    delisted.add(qid)
for r in fl:
    delisted.add(r['id'])
for r in absurd_delist:
    if r['table'] == 'questions':
        delisted.add(int(r['id']))

# ================= fixes.sql =================
# T3a：错模块/错题型归位（先做，保证后续 T6 依据新值）
MODCN = {'ziliao': '资料分析', 'shuliang': '数量关系', 'yanyu': '言语理解', 'panduan': '判断推理', 'changshi': '常识判断'}
_tax = json.load(open('/home/ubuntu/repos/kaogong-assistant/backend/app/data/taxonomy.json'))
MOD_GROUPS = {m['key']: {g['name'] for g in m['groups']} for m in _tax['modules']}
TAG3_GROUP = {t['code']: g['name'] for m in _tax['modules'] for g in m['groups'] for t in g['topics']}
TAG3_MOD = {t['code']: m['key'] for m in _tax['modules'] for g in m['groups'] for t in g['topics']}
fixes.write("\n-- ===== T3a QA P1-3a 错模块/错题型题归位（LLM 逐题复核）=====\n")
n3a = 0
t3a_fixed = set()
for r in jl('llm_module_fix.jsonl'):
    old = r.get('old') or {}
    if r.get('error') or not r.get('module') or r['module'] not in MODCN:
        L(task='T3a', id=r['id'], action='skip', reason=r.get('error') or 'invalid llm output')
        continue
    sub = (r.get('submodule') or '').strip()
    eff_tag3 = r.get('tag3') if TAG3_MOD.get(r.get('tag3')) == r['module'] else (old.get('tag3') if TAG3_MOD.get(old.get('tag3')) == r['module'] else None)
    r['tag3'] = eff_tag3  # 统一校验：tag3 必须属于目标模块，否则回退/置空
    if sub not in MOD_GROUPS.get(r['module'], set()) and eff_tag3 in TAG3_GROUP:
        sub = TAG3_GROUP[eff_tag3]  # 非法二级题型名：回退为 tag3 所属组名
    qt = f"{MODCN[r['module']]}-{sub}" if sub else None
    changes = {}
    if r['module'] != old['module']:
        changes['module'] = r['module']
    if sub and sub != (old['submodule'] or ''):
        changes['submodule'] = sub
    if r.get('tag3') and r['tag3'] != old['tag3']:
        changes['tag3'] = r['tag3']
    if qt and qt != (old['question_type'] or ''):
        changes['question_type'] = qt
    if not changes:
        L(task='T3a', id=r['id'], action='keep', detail='LLM 复核维持原分类')
        continue
    setsql = ', '.join(f"{k}='{esc(v)}'" for k, v in changes.items())
    fixes.write(f"UPDATE questions SET {setsql} WHERE id={r['id']};\n")
    L(task='T3a', id=r['id'], action='fix', before=old, after=changes, method='llm(deepseek)+rule')
    t3a_fixed.add(r['id'])
    n3a += 1

# T1/T5：文本清洗（跳过将下架的题；题干去噪若与现有题干撞 UNIQUE 约束则跳过题干仅改解析）
fixes.write("\n-- ===== T1/T5 QA P1-1 + data P1-1 文本清洗（页码残留/嵌套引号/空白噪声）=====\n")
existing_q = {row[0] for row in conn.execute("SELECT question FROM questions")}
clean_rows = jl('det_text_clean.jsonl')
seen_new = set()
collide = set()
for r in clean_rows:
    nq = r['set'].get('question')
    if nq and (nq in existing_q or nq in seen_new):
        collide.add(r['id'])
    elif nq:
        seen_new.add(nq)
n15 = 0
for r in clean_rows:
    if r['id'] in delisted:
        L(task='T1/T5', id=r['id'], action='skip', reason='将下架，不再清洗')
        continue
    if r['id'] in collide:
        if 'question' in r['set']:
            del r['set']['question']
        r['tags'].append('DUP_COLLISION_KEEP_QUESTION')
        if not r['set']:
            L(task='T1/T5', id=r['id'], action='skip', reason='题干去噪后与他题重复(UNIQUE)，保持原样并提示人工查重')
            continue
    sets = []
    if 'question' in r['set']:
        sets.append(f"question='{esc(r['set']['question'])}'")
    if 'explanation' in r['set']:
        sets.append(f"explanation='{esc(r['set']['explanation'])}'")
    fixes.write(f"UPDATE questions SET {', '.join(sets)} WHERE id={r['id']};\n")
    L(task='T1/T5', id=r['id'], action='fix', tags=r['tags'], fields=list(r['set'].keys()),
      in_low_cluster=r['in_low_cluster'], method='rule')
    n15 += 1

# T2：original 低质题修复
fixes.write("\n-- ===== T2 QA P1-2 original 低质题修复（LLM 逐题审查）=====\n")
for qid, reason, newe, newo in orig_fix:
    sets = []
    if newe:
        sets.append(f"explanation='{esc(newe)}'")
    if newo:
        sets.append(f"options='{esc(json.dumps(newo, ensure_ascii=False))}'")
    fixes.write(f"UPDATE questions SET {', '.join(sets)} WHERE id={qid};\n")
    L(task='T2', id=qid, action='fix', reason=reason, new_explanation=newe or None,
      new_options=newo, method='llm(deepseek)')
for qid, r in orig.items():
    if r.get('verdict') == 'ok':
        L(task='T2', id=qid, action='keep', reason=r.get('reason', ''), method='llm(deepseek)')

# T2 absurd 修复
fixes.write("\n-- ===== T2 不可能干扰项修复（含 shizheng_questions）=====\n")
for r in absurd_fix:
    tbl = r['table']; rid = int(str(r['id']).replace('sz-', ''))
    fixes.write(f"UPDATE {tbl} SET options='{esc(json.dumps(r['options'], ensure_ascii=False))}' WHERE id={rid};\n")
    L(task='T2-absurd', id=r['id'], table=tbl, action='fix', reason=r.get('reason', ''),
      new_options=r['options'], method='llm(deepseek)')

# T3b：submodule 同义合并（逐题展开进 ledger）
fixes.write("\n-- ===== T3b QA P1-3b submodule 同义分类合并 =====\n")
n3b = 0
for r in jl('det_submodule_merge.jsonl'):
    fixes.write(f"UPDATE questions SET submodule='{esc(r['to'])}' WHERE module='{r['module']}' AND submodule='{esc(r['from'])}';\n")
    for row in conn.execute("SELECT id FROM questions WHERE module=? AND submodule=?", (r['module'], r['from'])).fetchall():
        L(task='T3b', id=row['id'], action='fix', module=r['module'], submodule_from=r['from'], submodule_to=r['to'], method='rule(taxonomy-alias)')
        n3b += 1

# T6：submodule 空值回填
fixes.write("\n-- ===== T6 data P1-2 submodule 空值按 tag3 回填 =====\n")
n6 = 0
for r in jl('det_submodule_backfill.jsonl'):
    fixes.write(f"UPDATE questions SET submodule='{esc(r['to'])}' WHERE module='{r['module']}' AND tag3='{r['tag3']}' AND (submodule IS NULL OR trim(submodule)='');\n")
    for row in conn.execute("SELECT id FROM questions WHERE module=? AND tag3=? AND (submodule IS NULL OR trim(submodule)='')", (r['module'], r['tag3'])).fetchall():
        if row['id'] in t3a_fixed:
            continue  # T3a 已先行归位，SQL 不会再命中
        L(task='T6', id=row['id'], action='fix', module=r['module'], tag3=r['tag3'], submodule_to=r['to'], method='rule(tag3->group)')
        n6 += 1

# T4：mistakes 回填
fixes.write("\n-- ===== T4 data P0-2 mistakes.question_id 回填 =====\n")
for r in jl('det_mistakes_backfill.jsonl'):
    if r['task'] != 'T4-mistakes-backfill':
        continue
    fixes.write(f"UPDATE mistakes SET question_id={r['question_id']} WHERE id={r['mistake_id']} AND (question_id IS NULL OR question_id='');\n")
    L(task='T4', mistake_id=r['mistake_id'], action='fix', question_id=r['question_id'], method=r['method'])

# T7：source 人类可读映射
fixes.write("\n-- ===== T7 QA P2-8 source 人类可读映射 =====\n")
n7 = 0
for r in jl('det_source_map.jsonl'):
    fixes.write(f"UPDATE questions SET source='{esc(r['to'])}' WHERE source='{esc(r['from'])}';\n")
    L(task='T7', action='fix', source_from=r['from'], source_to=r['to'], count=r['count'], method='rule(regex)')
    n7 += r['count']
fixes.write("\nCOMMIT;\n")

# ================= delist.sql =================
delist.write("\n-- ===== T1b QA P1-1 公式丢失且解析不可读（规则检出，人工复核）=====\n")
for r in fl:
    delist.write(f"UPDATE questions SET disabled=1 WHERE id={r['id']};  -- 公式占位丢失 q:{r['q_slots']} e:{r['e_slots']}\n")
    L(task='T1b', id=r['id'], action='delist', reason=f"公式丢失不可读(q_slots={r['q_slots']},e_slots={r['e_slots']})", method='rule+manual-review')
delist.write("\n-- ===== T2 QA P1-2 original 低质题下架（LLM 逐题审查）=====\n")
for qid, reason in sorted(orig_delist):
    delist.write(f"UPDATE questions SET disabled=1 WHERE id={qid};  -- {reason}\n")
    L(task='T2', id=qid, action='delist', reason=reason, method='llm(deepseek)')
delist.write("\n-- ===== T2 不可能干扰项且无法修复 =====\n")
for r in absurd_delist:
    if r['table'] == 'questions':
        delist.write(f"UPDATE questions SET disabled=1 WHERE id={r['id']};  -- {r.get('reason','')}\n")
    else:
        rid = int(str(r['id']).replace('sz-', ''))
        delist.write(f"DELETE FROM shizheng_questions WHERE id={rid};  -- {r.get('reason','')}\n")
    L(task='T2-absurd', id=r['id'], table=r['table'], action='delist', reason=r.get('reason', ''), method='llm(deepseek)')
delist.write("\nCOMMIT;\n")

ledger.close(); fixes.close(); delist.close()
print(f"T3a fix {n3a} | T1/T5 clean {n15} | T2 fix {len(orig_fix)} delist {len(orig_delist)} ok {orig_ok} err {orig_err} pending {len(L_pending)}")
print(f"absurd fix {len(absurd_fix)} delist {len(absurd_delist)} | T3b {n3b} | T6 {n6} | T7 rows {n7} | formula-loss delist {len(fl)}")
