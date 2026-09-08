"""R8–R13 内容门禁只读 dry-run：扫描 questions 表，按规则输出命中数/占比/样本 qid/按 module 分布，写台账。

只读：用 sqlite3 `?mode=ro` URI 打开，脚本内只有 SELECT。用法（仓库根目录）：
    python backend/tools/content_gate_dryrun.py --db data.db
    python backend/tools/content_gate_dryrun.py --db /data/data.db --module ziliao --limit 5000 --out /tmp/ledger.md
"""
import argparse
import os
import sqlite3
import sys
import time
from collections import Counter, defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from app import quality

SAMPLE_N = 10
# R10/R13 近似比对两两 O(n²)，同 submodule 组内最多取这么多条（超出部分只做精确 shell 比对），台账如实标注
PAIR_CAP = 400
DEFAULT_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs", "iter", "workflow", "w13-content-gate-ledger.md")


def open_ro(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{os.path.abspath(path)}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def load_rows(conn, module: str | None, limit: int | None) -> list[dict]:
    sql = "SELECT id, module, submodule, source, question, options, explanation, hs_explanation FROM questions WHERE disabled=0"
    args: list = []
    if module:
        sql += " AND module=?"
        args.append(module)
    sql += " ORDER BY id"
    if limit:
        sql += " LIMIT ?"
        args.append(int(limit))
    return [dict(r) for r in conn.execute(sql, args)]


def _pairwise(items: list, key_fn, similar) -> set:
    keys = [key_fn(it) for it in items]
    hit = set()
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            if similar(keys[i], keys[j]):
                hit.add(items[i]["id"])
                hit.add(items[j]["id"])
    return hit


def scan(rows: list[dict]) -> dict:
    """返回 {rule: {"ids": [...], "note": str}}。"""
    hits: dict = {r: {"ids": [], "note": ""} for r in ("R8", "R9", "R10_exact", "R10_near", "R11", "R12", "R13")}
    hs_rows = [r for r in rows if (r.get("hs_explanation") or "").strip()]
    for r in rows:
        hs = r.get("hs_explanation") or ""
        exp = r.get("explanation") or ""
        if quality.hs_answer_reference(hs):
            hits["R8"]["ids"].append(r["id"])
        if quality.hollow_exclusion(hs) or quality.hollow_exclusion(exp):
            hits["R9"]["ids"].append(r["id"])
        if quality.arith_suspect(hs):
            hits["R11"]["ids"].append(r["id"])

    # R10：同 submodule 内 hs 壳精确重复（全量）+ 近似重复（组内 ≤PAIR_CAP 抽样）
    by_sub = defaultdict(list)
    for r in hs_rows:
        by_sub[(r["module"], r["submodule"])].append(r)
    exact, near, capped = set(), set(), 0
    for group in by_sub.values():
        sig_map = defaultdict(list)
        for r in group:
            r["_sig"] = quality.shell_signature(r["hs_explanation"])
            if len(r["_sig"]) >= quality.SHELL_MIN_LEN:
                sig_map[r["_sig"]].append(r["id"])
        for ids in sig_map.values():
            if len(ids) > 1:
                exact.update(ids)
        sample = [r for r in group if len(r["_sig"]) >= quality.SHELL_MIN_LEN]
        if len(sample) > PAIR_CAP:
            capped += 1
            sample = sample[:PAIR_CAP]
        near.update(_pairwise(sample, lambda r: r["_sig"], quality.shell_similar) - exact)
    hits["R10_exact"]["ids"] = sorted(exact)
    hits["R10_near"]["ids"] = sorted(near)
    hits["R10_near"]["note"] = f"同 submodule 组内两两比对，{capped} 组超过 {PAIR_CAP} 条只取前 {PAIR_CAP}" if capped else "同 submodule 组内全量两两比对"

    # R12/R13：只看 source='original'，同 submodule 内
    orig = defaultdict(list)
    for r in rows:
        if (r.get("source") or "") == "original":
            orig[(r["module"], r["submodule"])].append(r)
    fam_ids, clone_ids, clone_capped = set(), set(), 0
    for group in orig.values():
        fam = defaultdict(list)
        for r in group:
            fk = quality.synthetic_family_key(r)
            if fk:
                fam[fk].append(r["id"])
        for ids in fam.values():
            fam_ids.update(ids)
        by_opts = defaultdict(list)
        for r in group:
            ck = quality.clone_key(r["question"], r["options"])
            r["_ck"] = ck
            if ck[1]:
                by_opts[ck[1]].append(r)
        for g in by_opts.values():
            if len(g) < 2:
                continue
            if len(g) > PAIR_CAP:
                clone_capped += 1
                g = g[:PAIR_CAP]
            clone_ids.update(_pairwise(g, lambda r: r["_ck"], quality.is_clone))
    hits["R12"]["ids"] = sorted(fam_ids)
    hits["R12"]["note"] = "source='original' 且命中 ≥2 项母版指纹（不要求族内 ≥2 题）"
    hits["R13"]["ids"] = sorted(clone_ids)
    hits["R13"]["note"] = f"source='original' 同 submodule 同选项集合组内两两比对 ratio≥{quality.CLONE_STEM_RATIO}" + (f"，{clone_capped} 组截断到 {PAIR_CAP}" if clone_capped else "")
    return hits


RULE_LABEL = {
    "R8": "hs 引用答题参考（hard）",
    "R9": "伪排错句（soft，批内≥3 整批拒）",
    "R10_exact": "hs 壳精确重复（soft）",
    "R10_near": "hs 壳近似重复 ratio≥0.9（soft，批内≥3 整批拒）",
    "R11": "算式复算误差>2%（soft）",
    "R12": "合成题族指纹（soft）",
    "R13": "克隆题（soft）",
}


def render(db_path: str, module: str | None, limit: int | None, rows: list[dict], hits: dict, data_version: tuple) -> str:
    total = len(rows)
    n_hs = sum(1 for r in rows if (r.get("hs_explanation") or "").strip())
    n_orig = sum(1 for r in rows if (r.get("source") or "") == "original")
    by_id = {r["id"]: r for r in rows}
    out = [
        "# W13 内容门禁 dry-run 台账（R8–R13，只读）",
        "",
        f"- 生成时间：{time.strftime('%Y-%m-%d %H:%M:%S')}",
        f"- 库：`{db_path}`（`?mode=ro` 只读打开；PRAGMA data_version 前/后 = {data_version[0]}/{data_version[1]}，变化只可能来自其它连接的提交，本连接为 ro）",
        f"- 范围：module={module or '全部'} limit={limit or '不限'}；扫描 disabled=0 行 {total} 条，其中含 hs {n_hs} 条、source='original' {n_orig} 条",
        "- 规则实现：`backend/app/quality.py` R8–R13 纯函数；批次门禁 `backend/app/content_gate.py`（只拦新批次，不改存量）",
        "",
        "## 命中汇总",
        "",
        "| 规则 | 说明 | 命中 | 占比(分母) | 样本 qid（≤10） |",
        "|---|---|---|---|---|",
    ]
    for rule, h in hits.items():
        ids = h["ids"]
        denom = (n_orig if rule in ("R12", "R13") else total if rule == "R9" else n_hs) or 1
        pct = f"{len(ids) / denom * 100:.2f}% ({denom})"
        sample = ", ".join(str(i) for i in ids[:SAMPLE_N]) or "—"
        out.append(f"| {rule} | {RULE_LABEL[rule]} | {len(ids)} | {pct} | {sample} |")
    out += ["", "## 按 module 分布", "", "| 规则 | " + " | ".join(m for m in sorted({r['module'] or '?' for r in rows})) + " |"]
    mods = sorted({r["module"] or "?" for r in rows})
    out.append("|---|" + "---|" * len(mods))
    for rule, h in hits.items():
        c = Counter((by_id[i]["module"] or "?") for i in h["ids"])
        out.append(f"| {rule} | " + " | ".join(str(c.get(m, 0)) for m in mods) + " |")
    out += ["", "## 备注", ""]
    for rule, h in hits.items():
        if h["note"]:
            out.append(f"- {rule}：{h['note']}")
    out += [
        "- R8 为唯一逐条 hard 拒收规则（措辞精确）；R9/R10 仅批次阈值整批拒收；R11/R12/R13 只软标，本台账用于确认误报率后再决定是否升级。",
        "- 本脚本不写库、不改存量；存量命中项如何处置（重写/下线）留待人工抽检后另立工作项。",
        "",
        "## 样本原文抽检（每规则 ≤3 条，截断 160 字；「←」后为命中片段）",
        "",
    ]
    for rule, h in hits.items():
        for i in h["ids"][:3]:
            r = by_id[i]
            text = (r.get("hs_explanation") if rule not in ("R12", "R13") else r.get("question")) or r.get("explanation") or ""
            text = text.replace("\n", " ").replace("|", "\\|")[:160]
            frag = _matched_fragment(rule, r)
            out.append(f"- {rule} q{i} [{r['module']}/{r.get('submodule') or '-'}/{r.get('source') or '-'}]：{text}" + (f" ← {frag}" if frag else ""))
    return "\n".join(out) + "\n"


def _matched_fragment(rule: str, r: dict) -> str:
    hs, exp = r.get("hs_explanation") or "", r.get("explanation") or ""
    if rule == "R8":
        m = quality.ANSWER_REF_RE.search(hs)
        return m.group(0) if m else ""
    if rule == "R9":
        return " / ".join(quality.hollow_exclusion(hs) or quality.hollow_exclusion(exp))[:80]
    if rule == "R11":
        return " / ".join(quality.arith_suspect(hs))[:80]
    if rule == "R12":
        return quality.synthetic_family_key(r) or ""
    return ""


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", required=True, help="SQLite 路径（只读打开）")
    ap.add_argument("--module", default=None)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--out", default=DEFAULT_OUT, help="台账 markdown 输出路径；'-' 只打印不写文件")
    args = ap.parse_args(argv)

    conn = open_ro(args.db)
    try:
        dv0 = conn.execute("PRAGMA data_version").fetchone()[0]
        rows = load_rows(conn, args.module, args.limit)
        hits = scan(rows)
        dv1 = conn.execute("PRAGMA data_version").fetchone()[0]
    finally:
        conn.close()
    md = render(args.db, args.module, args.limit, rows, hits, (dv0, dv1))
    print(md)
    if args.out != "-":
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(md)
        print(f"[written] {os.path.abspath(args.out)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
