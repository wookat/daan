#!/usr/bin/env python3
"""导出在架生成题中极简解析（去空白 <30 字符）清单 → targets.jsonl。"""
import json, os, re, sqlite3

DB = os.environ.get('DB', os.path.expanduser('~/r4/snap_r4.db'))
OUT = os.environ.get('OUT', os.path.expanduser('~/r4/targets.jsonl'))


def slen(s):
    return len(re.sub(r'\s', '', s or ''))


conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
rows = conn.execute(
    "SELECT id, module, submodule, question, options, answer, explanation, source, is_real "
    "FROM questions WHERE coalesce(disabled,0)=0 "
    "AND (source LIKE 'original%' OR coalesce(is_real,0)!=1)").fetchall()
n = 0
with open(OUT, 'w', encoding='utf-8') as f:
    for r in rows:
        if slen(r['explanation']) < 30:
            f.write(json.dumps({
                'id': r['id'], 'module': r['module'], 'submodule': r['submodule'],
                'question': r['question'], 'options': json.loads(r['options'] or '{}'),
                'answer': r['answer'], 'explanation': r['explanation'],
            }, ensure_ascii=False) + '\n')
            n += 1
print('targets:', n)
