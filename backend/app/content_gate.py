"""题目 / hs 讲解入库批次门禁（w12c-content-human.md §4 R8–R13）。

路由层前置过滤：只拦新批次，不重写存量，不改 db.import_* 与表结构。
- R8 hs 引用答题参考 → 逐条 hard 拒收
- R9 伪排错句 / R10 批内整段复用壳 → 软标；同批 ≥BATCH_SOFT_MAX 条 → 整批拒收
- R11 算式复算 / R12 合成题族 / R13 克隆题 → 只软标
- R12 只看新题自身指纹组合；R13 对比库内同 submodule source='original' 行，只读 SELECT
- 门禁自身任何异常 → batch_rejected（fail-closed），绝不放行
"""
import logging

from . import db, quality

log = logging.getLogger(__name__)

BATCH_SOFT_MAX = 3
# 库内对比样本上限（同 submodule 的 original 行，按 id 倒序取最近的）
_STORED_LIMIT = 2000


def _receipt(rejected=None, flagged=None, batch_rejected=False, reason=None) -> dict:
    return {
        "rejected": rejected or [],
        "flagged": flagged or [],
        "batch_rejected": batch_rejected,
        "reason": reason,
    }


def _flag(flags: dict, key, rule: str):
    flags.setdefault(key, [])
    if rule not in flags[key]:
        flags[key].append(rule)


def _pairwise_hits(sigs: list, similar) -> set:
    """两两比对，返回至少与另一条互相命中的下标集合。"""
    hit = set()
    for i in range(len(sigs)):
        for j in range(i + 1, len(sigs)):
            if similar(sigs[i], sigs[j]):
                hit.add(i)
                hit.add(j)
    return hit


def _stored_original(submodule: str | None, cols: str) -> list:
    """同 submodule 的 source='original' 存量行，只读。submodule 为空时按 NULL 匹配。"""
    conn = db.get_conn()
    try:
        if submodule:
            rows = conn.execute(
                f"SELECT {cols} FROM questions WHERE source='original' AND submodule=? ORDER BY id DESC LIMIT ?",
                (submodule, _STORED_LIMIT),
            ).fetchall()
        else:
            rows = conn.execute(
                f"SELECT {cols} FROM questions WHERE source='original' AND submodule IS NULL ORDER BY id DESC LIMIT ?",
                (_STORED_LIMIT,),
            ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def _gate_hs(items: list[dict]) -> tuple[list[dict], dict]:
    rejected: list[dict] = []
    flags: dict = {}
    kept: list[dict] = []
    for it in items:
        qid = it.get("id")
        text = it.get("hs_explanation") or ""
        if quality.hs_answer_reference(text):
            rejected.append({"id": qid, "rule": "R8"})
            continue
        if quality.hollow_exclusion(text):
            _flag(flags, qid, "R9")
        if quality.arith_suspect(text):
            _flag(flags, qid, "R11")
        kept.append(it)

    # R10：批内整段复用（含同批多条 + 与同 submodule 存量 hs 比对，存量只用于软标）
    sigs = [quality.shell_signature(it.get("hs_explanation")) for it in kept]
    dup_idx = _pairwise_hits(sigs, quality.shell_similar)
    for i in dup_idx:
        _flag(flags, kept[i].get("id"), "R10")
    if kept:
        ids = [int(it["id"]) for it in kept if str(it.get("id") or "").isdigit()]
        if ids:
            conn = db.get_conn()
            try:
                subs = conn.execute(
                    f"SELECT DISTINCT submodule FROM questions WHERE id IN ({','.join('?' * len(ids))})", ids
                ).fetchall()
                sub_list = [r["submodule"] for r in subs if r["submodule"]]
                stored = []
                if sub_list:
                    stored = conn.execute(
                        f"SELECT id, hs_explanation FROM questions WHERE has_hs=1 AND submodule IN ({','.join('?' * len(sub_list))}) "
                        f"AND id NOT IN ({','.join('?' * len(ids))}) ORDER BY id DESC LIMIT ?",
                        (*sub_list, *ids, _STORED_LIMIT),
                    ).fetchall()
            finally:
                conn.close()
            stored_sigs = [quality.shell_signature(r["hs_explanation"]) for r in stored]
            for i, sig in enumerate(sigs):
                if i in dup_idx or not sig:
                    continue
                if any(quality.shell_similar(sig, s) for s in stored_sigs):
                    _flag(flags, kept[i].get("id"), "R10")

    n_r9 = sum(1 for r in flags.values() if "R9" in r)
    reason = None
    if n_r9 >= BATCH_SOFT_MAX:
        reason = f"R9 hollow_exclusion x{n_r9} >= {BATCH_SOFT_MAX}"
    elif len(dup_idx) >= BATCH_SOFT_MAX:
        reason = f"R10 shell_dup x{len(dup_idx)} >= {BATCH_SOFT_MAX}"
    flagged = [{"id": k, "rules": v} for k, v in flags.items()]
    if reason:
        return [], _receipt(rejected, flagged, True, reason)
    return kept, _receipt(rejected, flagged)


def _gate_questions(items: list[dict]) -> tuple[list[dict], dict]:
    rejected: list[dict] = []
    flags: dict = {}
    kept: list[tuple] = []
    for idx, q in enumerate(items):
        key = q.get("id") if q.get("id") is not None else idx
        text = " ".join(str(q.get(k) or "") for k in ("explanation", "hs_explanation"))
        if quality.hs_answer_reference(text):
            rejected.append({"id": key, "rule": "R8"})
            continue
        if quality.hollow_exclusion(text):
            _flag(flags, key, "R9")
        if quality.arith_suspect(text):
            _flag(flags, key, "R11")
        kept.append((key, q))

    # R12/R13 只对 source='original' 的新题；R13 与同 submodule 存量 original 行 + 批内两两比对
    by_sub: dict = {}
    for key, q in kept:
        if (q.get("source") or "") == "original":
            by_sub.setdefault(db.normalize_submodule(q.get("submodule")), []).append((key, q))
    for sub, group in by_sub.items():
        stored = _stored_original(sub, "id, question, options")
        stored_clone = [quality.clone_key(r["question"], r["options"]) for r in stored]
        batch_clone = []
        for key, q in group:
            if quality.synthetic_family_key(q):
                _flag(flags, key, "R12")
            ck = quality.clone_key(q.get("question"), q.get("options"))
            batch_clone.append((key, ck))
            if any(quality.is_clone(ck, sc) for sc in stored_clone):
                _flag(flags, key, "R13")
        for i in range(len(batch_clone)):
            for j in range(i + 1, len(batch_clone)):
                if quality.is_clone(batch_clone[i][1], batch_clone[j][1]):
                    _flag(flags, batch_clone[i][0], "R13")
                    _flag(flags, batch_clone[j][0], "R13")

    # R10：批内 hs/explanation 整段复用壳
    sigs = [quality.shell_signature(q.get("hs_explanation") or q.get("explanation")) for _, q in kept]
    dup_idx = _pairwise_hits(sigs, quality.shell_similar)
    for i in dup_idx:
        _flag(flags, kept[i][0], "R10")

    n_r9 = sum(1 for r in flags.values() if "R9" in r)
    reason = None
    if n_r9 >= BATCH_SOFT_MAX:
        reason = f"R9 hollow_exclusion x{n_r9} >= {BATCH_SOFT_MAX}"
    elif len(dup_idx) >= BATCH_SOFT_MAX:
        reason = f"R10 shell_dup x{len(dup_idx)} >= {BATCH_SOFT_MAX}"
    flagged = [{"id": k, "rules": v} for k, v in flags.items()]
    if reason:
        return [], _receipt(rejected, flagged, True, reason)
    return [q for _, q in kept], _receipt(rejected, flagged)


def _fail_closed(fn, items):
    try:
        return fn(list(items or []))
    except Exception as e:
        log.exception("content_gate failed closed")
        return [], _receipt(batch_rejected=True, reason=f"gate_error: {type(e).__name__}: {e}")


def gate_hs(items: list[dict]) -> tuple[list[dict], dict]:
    """hs_import 批次门禁。返回 (放行 items, receipt)；batch_rejected 时放行为空。"""
    return _fail_closed(_gate_hs, items)


def gate_questions(items: list[dict]) -> tuple[list[dict], dict]:
    """questions/import 批次门禁。返回 (放行 items, receipt)；batch_rejected 时放行为空。"""
    return _fail_closed(_gate_questions, items)
