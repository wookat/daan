#!/usr/bin/env python3
"""合并题库批次到 knowledge/questions_bank.jsonl：格式校验 + 按题干去重。用法: merge_bank.py file1.jsonl [file2 ...]"""
import json, sys, collections, os

BANK = os.path.join(os.path.dirname(__file__), '..', 'knowledge', 'questions_bank.jsonl')
MODS = {'ziliao', 'shuliang', 'yanyu', 'panduan', 'changshi'}

existing = [json.loads(l) for l in open(BANK) if l.strip()]
seen = {q['question'] for q in existing}
merged = list(existing)
bad = dup = incoming = 0
for f in sys.argv[1:]:
    for l in open(f):
        l = l.strip()
        if not l:
            continue
        try:
            q = json.loads(l)
        except json.JSONDecodeError:
            bad += 1
            continue
        incoming += 1
        ok = (q.get('module') in MODS and q.get('question') and isinstance(q.get('options'), dict)
              and set(q['options']) >= {'A', 'B', 'C', 'D'} and q.get('answer') in q['options']
              and q.get('source') and q.get('explanation') and '\\frac' not in l)
        if not ok:
            bad += 1
            continue
        if q['question'] in seen:
            dup += 1
            continue
        seen.add(q['question'])
        merged.append(q)
print(f'incoming={incoming} bad={bad} dup={dup} total={len(merged)}')
print(dict(collections.Counter(q['module'] for q in merged)))
with open(BANK, 'w') as f:
    for q in merged:
        f.write(json.dumps(q, ensure_ascii=False) + '\n')
