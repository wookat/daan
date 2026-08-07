#!/usr/bin/env python3
"""合并各轮重写输出，生成 ledger.jsonl / fixes.sql / summary.json。

优先级（后轮覆盖前轮）：p1（首轮批量）< p2（结构重试）< p3（人工抽检拒绝项重写）
< p4（遗漏收口）< p5（终检不合格重写）< p6（人工抽检不合格重写）。
reject_p1.json / reject_p2.json 中的 qid 对应轮次结果作废，只接受更后轮结果。
用法：python3 make_artifacts.py <r4_dir> <iter_dir>
"""
import collections
import json
import os
import sys

from rewrite import validate


def load_fixes(paths):
    out = {}
    for p in paths:
        for line in open(p):
            try:
                r = json.loads(line)
            except Exception:
                continue
            if r.get('action') == 'fix':
                out[r['id']] = r['explanation']
    return out


def sql_quote(s):
    return "'" + s.replace("'", "''") + "'"


def main():
    r4 = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/r4')
    dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
        os.path.dirname(__file__), '..')
    targets = {}
    for line in open(os.path.join(r4, 'targets.jsonl')):
        t = json.loads(line)
        targets[t['id']] = t
    def load_reject(name):
        p = os.path.join(r4, name)
        return set(json.load(open(p))) if os.path.exists(p) else set()

    reject1 = load_reject('reject_p1.json')
    reject2 = load_reject('reject_p2.json')

    out = os.path.join(r4, 'out')
    passes = [
        # (本轮 fix 文件, 本轮结果作废的 qid 集合)
        ([os.path.join(out, f) for f in (
            'pilot_out.jsonl', 'scale_out.jsonl', 'scaleb_out.jsonl',
            'full_0.jsonl', 'full_1.jsonl', 'full_2.jsonl', 'full_3.jsonl',
            'full_4.jsonl', 'full_5.jsonl', 'full_6.jsonl', 'full_7.jsonl',
            'batch_0.jsonl', 'batch_1.jsonl', 'batch_2.jsonl',
            'batch_3.jsonl')], reject1),
        ([os.path.join(out, f'p2_{i}.jsonl') for i in range(4)], reject2),
        ([os.path.join(out, 'p3.jsonl')], set()),
        ([os.path.join(out, f'p4_{i}.jsonl') for i in range(4)], set()),
        ([os.path.join(out, 'p5.jsonl')], set()),
        ([os.path.join(out, 'p6.jsonl')], set()),
    ]

    best = {}
    for paths, rej in passes:
        cand = load_fixes(p for p in paths if os.path.exists(p))
        for qid, new in cand.items():
            if qid in rej:
                continue
            best[qid] = new

    fixes, keeps = {}, {}
    for qid, t in targets.items():
        new = best.get(qid)
        if new is None:
            keeps[qid] = '多轮重写未产出合格解析（建议下架或人工补写）'
            continue
        err = validate(new, t)
        if err:
            keeps[qid] = f'终检未过：{err}'
        else:
            fixes[qid] = new

    with open(os.path.join(dst, 'ledger.jsonl'), 'w', encoding='utf-8') as f:
        for qid in sorted(targets):
            t = targets[qid]
            rec = {'id': qid, 'module': t['module'], 'answer': t['answer'],
                   'old': t['explanation']}
            if qid in fixes:
                rec.update(action='fix', new=fixes[qid])
            else:
                rec.update(action='keep', reason=keeps[qid])
            f.write(json.dumps(rec, ensure_ascii=False) + '\n')

    with open(os.path.join(dst, 'fixes.sql'), 'w', encoding='utf-8') as f:
        f.write('-- iter-r4: 生成题极简解析批量补强（仅更新 explanation）\n')
        f.write('-- 生产执行：先备份，再事务内执行，核对行数后 COMMIT\n')
        f.write('BEGIN TRANSACTION;\n')
        for qid in sorted(fixes):
            t = targets[qid]
            f.write(f"UPDATE questions SET explanation={sql_quote(fixes[qid])} "
                    f"WHERE id={qid} AND answer={sql_quote(t['answer'])};\n")
        f.write('COMMIT;\n')

    mod = collections.Counter(targets[q]['module'] for q in targets)
    mod_fix = collections.Counter(targets[q]['module'] for q in fixes)
    summary = {
        'targets': len(targets), 'fixed': len(fixes), 'keep': len(keeps),
        'by_module': {m: {'targets': mod[m], 'fixed': mod_fix.get(m, 0)}
                      for m in sorted(mod)},
        'keep_reasons': dict(collections.Counter(keeps.values())),
    }
    json.dump(summary, open(os.path.join(dst, 'summary.json'), 'w'),
              ensure_ascii=False, indent=2)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
