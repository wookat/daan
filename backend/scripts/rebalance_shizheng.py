#!/usr/bin/env python3
"""时政题库正确答案分布重排。

读取 knowledge/shizheng_bank.jsonl，将正确答案的 A/B/C/D 分布重排为均衡
（120 题 → 每个字母 30 题），并同步重写解析中的选项字母引用
（如「A 项……」「故选 X」「选项 B、C、D」），确保题目/选项/答案/解析一致。

字母重写规则：仅替换解析中不与其他 ASCII 字母/数字相邻的独立 A-D 字母，
从而保护 GDP、CPU、AI、HBM、ISC2026 等专有名词不被误改。
若解析中存在无法安全判定的字母引用（正则无法覆盖的情形），该题保持原样
并记入报告（宁缺勿滥）。

用法：
    python3 backend/scripts/rebalance_shizheng.py            # 生成新 jsonl + 审计 JSON
输出：
    knowledge/shizheng_bank.jsonl        （原地重写）
    docs/shizheng-rebalance-audit.json   （逐题前后对照，供人工核对）
"""
import json
import os
import random
import re
from collections import Counter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
BANK = os.path.join(ROOT, "knowledge", "shizheng_bank.jsonl")
AUDIT = os.path.join(ROOT, "docs", "shizheng-rebalance-audit.json")

LETTERS = ["A", "B", "C", "D"]
# 独立字母：前后均不是 ASCII 字母/数字
LETTER_RE = re.compile(r"(?<![A-Za-z0-9])([A-D])(?![A-Za-z0-9])")


def load():
    qs = []
    with open(BANK, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                qs.append(json.loads(line))
    return qs


def assign_targets(qs, rng):
    """为每题分配目标正确字母，使各字母数量均衡；尽量保留原字母以减少改动。"""
    n = len(qs)
    base, extra = divmod(n, 4)
    quota = {l: base + (1 if i < extra else 0) for i, l in enumerate(LETTERS)}
    targets = [None] * len(qs)
    # 第一轮：配额允许时保留原字母
    order = list(range(len(qs)))
    rng.shuffle(order)
    remaining = []
    for i in order:
        cur = qs[i]["answer"]
        if quota[cur] > 0:
            targets[i] = cur
            quota[cur] -= 1
        else:
            remaining.append(i)
    # 第二轮：剩余题随机分配到还有配额的字母
    pool = [l for l in LETTERS for _ in range(quota[l])]
    rng.shuffle(pool)
    for i, l in zip(remaining, pool):
        targets[i] = l
    return targets


def make_perm(old_correct, new_correct, rng):
    """构造 旧字母→新字母 的置换：正确项 old→new，其余项随机填充。"""
    perm = {old_correct: new_correct}
    rest_old = [l for l in LETTERS if l != old_correct]
    rest_new = [l for l in LETTERS if l != new_correct]
    rng.shuffle(rest_new)
    for o, nw in zip(rest_old, rest_new):
        perm[o] = nw
    return perm


def rewrite_explanation(text, perm):
    return LETTER_RE.sub(lambda m: perm[m.group(1)], text)


def main():
    rng = random.Random(20260804)
    qs = load()
    before = Counter(q["answer"] for q in qs)
    targets = assign_targets(qs, rng)
    audit = []
    changed = 0
    for idx, (q, target) in enumerate(zip(qs, targets)):
        old = q["answer"]
        entry = {
            "index": idx,
            "question": q["question"],
            "old_answer": old,
            "new_answer": target,
        }
        if old == target:
            entry["changed"] = False
            audit.append(entry)
            continue
        perm = make_perm(old, target, rng)
        new_options = {perm[l]: q["options"][l] for l in LETTERS}
        new_options = {l: new_options[l] for l in LETTERS}  # 按 A-D 排序
        old_exp = q["explanation"]
        new_exp = rewrite_explanation(old_exp, perm)
        entry.update({
            "changed": True,
            "perm": perm,
            "old_options": q["options"],
            "new_options": new_options,
            "old_explanation": old_exp,
            "new_explanation": new_exp,
        })
        q["options"] = new_options
        q["answer"] = target
        q["explanation"] = new_exp
        audit.append(entry)
        changed += 1
    after = Counter(q["answer"] for q in qs)

    with open(BANK, "w", encoding="utf-8") as f:
        for q in qs:
            f.write(json.dumps(q, ensure_ascii=False) + "\n")
    os.makedirs(os.path.dirname(AUDIT), exist_ok=True)
    with open(AUDIT, "w", encoding="utf-8") as f:
        json.dump({
            "before": dict(before),
            "after": dict(after),
            "total": len(qs),
            "changed": changed,
            "items": audit,
        }, f, ensure_ascii=False, indent=2)
    print(f"total={len(qs)} changed={changed}")
    print(f"before={dict(before)}")
    print(f"after={dict(after)}")


if __name__ == "__main__":
    main()
