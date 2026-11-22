#!/usr/bin/env python3
"""合并题库批次到 knowledge/questions_bank.jsonl：格式校验 + 按题干去重。用法: merge_bank.py file1.jsonl [file2 ...]"""
import collections
import json
import os
import sys

BANK = os.path.join(os.path.dirname(__file__), '..', 'knowledge', 'questions_bank.jsonl')
MODS = {'ziliao', 'shuliang', 'yanyu', 'panduan', 'changshi'}

existing = [json.loads(line) for line in open(BANK) if line.strip()]
seen = {q['question'] for q in existing}
merged = list(existing)
bad = dup = incoming = 0
for f in sys.argv[1:]:
    for line in open(f):
        line = line.strip()
        if not line:
            continue
        try:
            q = json.loads(line)
        except json.JSONDecodeError:
            bad += 1
            continue
        incoming += 1
        ok = (q.get('module') in MODS and q.get('question') and isinstance(q.get('options'), dict)
              and set(q['options']) >= {'A', 'B', 'C', 'D'} and q.get('answer') in q['options']
              and q.get('source') and q.get('explanation') and '\\frac' not in line)
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
