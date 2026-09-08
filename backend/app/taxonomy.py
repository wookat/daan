"""三级考点树：加载 taxonomy.json 并提供索引/候选查询。"""
import json
import os

PATH = os.path.join(os.path.dirname(__file__), "data", "taxonomy.json")

_tree: dict | None = None
_topic_idx: dict | None = None
_alias_idx: dict | None = None


def tree() -> dict:
    global _tree
    if _tree is None:
        with open(PATH, encoding="utf-8") as f:
            _tree = json.load(f)
    return _tree or {}


def _build():
    global _topic_idx, _alias_idx
    _topic_idx, _alias_idx = {}, {}
    for m in tree()["modules"]:
        for g in m["groups"]:
            for alias in set(g.get("aliases", []) + [g["name"]]):
                _alias_idx.setdefault((m["key"], alias), []).append(g)
            for t in g["topics"]:
                _topic_idx[t["code"]] = {
                    "name": t["name"],
                    "desc": t.get("desc", ""),
                    "usage": t.get("usage", ""),
                    "group_code": g["code"],
                    "group_name": g["name"],
                    "module": m["key"],
                    "module_name": m["name"],
                }


def topic_index() -> dict:
    if _topic_idx is None:
        _build()
    return _topic_idx or {}


def alias_index() -> dict:
    if _alias_idx is None:
        _build()
    return _alias_idx or {}


def groups_for(module: str, submodule: str | None) -> list[dict]:
    """按题目 submodule 找到二级题型分组；找不到时回退整模块所有分组。"""
    if submodule:
        gs = alias_index().get((module, submodule.strip()))
        if gs:
            return gs
    return [g for m in tree()["modules"] if m["key"] == module for g in m["groups"]]


def group_name(module: str | None, submodule: str | None) -> str | None:
    """题型组规范名：submodule 命中分组名/别名时回规范组名，否则回 submodule 原文。"""
    sub = (submodule or "").strip()
    if not sub:
        return None
    gs = alias_index().get((module or "", sub))
    return gs[0]["name"] if gs else sub


def group_submodules(module: str | None, name: str) -> list[str]:
    """题型组在题库 submodule 列上的全部取值（组名 + aliases）；未知组只回自身。"""
    name = (name or "").strip()
    if not name:
        return []
    out = {name}
    for m in tree()["modules"]:
        if module and m["key"] != module:
            continue
        for g in m["groups"]:
            if g["name"] == name:
                out.update(g.get("aliases", []))
    return sorted(out)


def candidate_topics(module: str, submodule: str | None) -> list[dict]:
    out = []
    for g in groups_for(module, submodule):
        out.extend(g["topics"])
    return out
