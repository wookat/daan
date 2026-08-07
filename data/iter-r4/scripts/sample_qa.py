#!/usr/bin/env python3
"""抽检样本生成：从 ledger.jsonl 的 fix 结果按 qid 排序切 500 条一批，
每批 seed=4444 抽 20 条 → samples.jsonl（与 make_artifacts.py 的合并结果一致）。"""
import json, os, random, sys

LEDGER = os.environ.get('LEDGER', os.path.join(
    os.path.dirname(__file__), '..', 'ledger.jsonl'))
TARGETS = os.environ.get('TARGETS', os.path.expanduser('~/r4/targets.jsonl'))
DEST = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/r4/samples.jsonl')

tg = {}
for l in open(TARGETS):
    r = json.loads(l)
    tg[r['id']] = r

best = {}
for l in open(LEDGER):
    r = json.loads(l)
    if r['action'] == 'fix':
        best[r['id']] = r['new']

qids = sorted(best)
rng = random.Random(4444)
with open(DEST, 'w', encoding='utf-8') as out:
    for bi in range(0, len(qids), 500):
        chunk = qids[bi:bi + 500]
        for qid in sorted(rng.sample(chunk, min(20, len(chunk)))):
            t = tg[qid]
            out.write(json.dumps({
                'batch': bi // 500, 'id': qid, 'module': t['module'],
                'question': t['question'], 'options': t['options'], 'answer': t['answer'],
                'old': t['explanation'], 'new': best[qid],
            }, ensure_ascii=False) + '\n')
print('batches:', (len(qids) + 499) // 500, 'fixes:', len(qids))
