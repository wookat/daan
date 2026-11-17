#!/usr/bin/env python3
"""外链图片本地化 + 卷内真重复题去重 + 缺图题下架。

1) questions.image 里的 fenbi/fbstatic 外链下载进 /data/qimg/ext-<md5>.<ext>，
   image 改写为 /qimg/<本地名>（多题共享同一外链时只下一次）。
2) exam_papers.question_ids 按"完整规范题干"去重（保留首个出现）——
   修此前按 qid 去重漏掉的同文异号重复（用户刷卷看到同一题出现两次）。
3) 图片引用 /qimg/* 但文件缺失的题标 disabled=1（图是解题必需，缺图不可答）。

用法（容器内）：
    python backend/scripts/xt_fix_extimg.py --plan
    python backend/scripts/xt_fix_extimg.py --apply
"""
import argparse
import concurrent.futures as cf
import hashlib
import json
import os
import re
import sqlite3
import urllib.request

DB = os.environ.get("DB_PATH", "/data/data.db")
QIMG = os.environ.get("QIMG_DIR", "/data/qimg")
UA = {"User-Agent": "Mozilla/5.0 (asset-mirror)"}
_EXT = {"image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp", "image/svg+xml": ".svg"}


def norm(t: str) -> str:
    t = re.sub(r"（材料\s*\d+）", "", t or "")
    return re.sub(r"[^0-9A-Za-z一-鿿]", "", t)


def collect_ext(conn):
    urls = {}
    rows = conn.execute(
        "SELECT id, image FROM questions WHERE image LIKE '%fenbi%' OR image LIKE '%fbstatic%'"
    ).fetchall()
    for r in rows:
        urls.setdefault(r[1], []).append(r[0])
    return urls, rows


def fetch_one(url: str):
    name = "ext-" + hashlib.md5(url.encode()).hexdigest()
    for f in os.listdir(QIMG):
        if f.startswith(name + "."):
            return url, f, -1  # 已存在，续跑直复用
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as resp:
        ctype = (resp.headers.get("Content-Type") or "").split(";")[0].strip()
        data = resp.read()
    ext = _EXT.get(ctype)
    if not ext:
        # 从 URL 路径猜扩展名
        m = re.search(r"\.(png|jpe?g|gif|webp|svg)(?:\?|$)", url)
        ext = m.group(0).split("?")[0].replace("jpeg", ".jpg") if m else ".png"
        if not ext.startswith("."):
            ext = "." + ext
    fname = name + ext
    with open(os.path.join(QIMG, fname), "wb") as f:
        f.write(data)
    return url, fname, len(data)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--plan", action="store_true")
    ap.add_argument("--workers", type=int, default=16)
    args = ap.parse_args()

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    urls, rows = collect_ext(conn)
    print(f"[ext] 外链图题 {len(rows)} 题，去重后 {len(urls)} 个外链")

    # 3) 缺图题盘点
    missing = []
    for rid, img in conn.execute("SELECT id, image FROM questions WHERE image LIKE '/qimg/%'"):
        if not os.path.exists(os.path.join(QIMG, os.path.basename(img))):
            missing.append(rid)
    print(f"[miss] /qimg 引用但文件缺失 {len(missing)} 题")

    # 2) 卷内真重复盘点
    dup_edit = {}
    for p in conn.execute("SELECT id, title, question_ids FROM exam_papers WHERE kind='zhenti'"):
        ids = json.loads(p["question_ids"] or "[]")
        if not ids:
            continue
        ph = ",".join("?" * len(ids))
        qmap = {r["id"]: (r["question"], r["options"]) for r in conn.execute(
            f"SELECT id, question, options FROM questions WHERE id IN ({ph})", ids)}
        seen, kept, drop = set(), [], 0
        for qid in ids:
            q = qmap.get(qid)
            if q is None:
                kept.append(qid)  # 已删/下架题保持原样（active 过滤在 API 侧）
                continue
            k = (norm(q[0]), norm(q[1]))
            # 符号/图形推理题规范化后为空串——长度不足一律视为不同题，防误删
            if len(k[0]) < 15:
                kept.append(qid)
                continue
            if k in seen:
                drop += 1
                continue
            seen.add(k)
            kept.append(qid)
        if drop:
            dup_edit[p["id"]] = (p["title"], len(ids), len(kept), drop)
    print(f"[dup] 卷内同文重复卷 {len(dup_edit)} 套，将剔除 {sum(v[3] for v in dup_edit.values())} 条")
    for pid, v in list(dup_edit.items())[:10]:
        print("   ", pid, v)

    if not args.apply:
        return

    # --- 下载外链 ---
    ok, fail = 0, {}
    local_name = {}  # url -> 本地文件名（独立于 urls 的 qid 列表，勿覆写）
    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(fetch_one, u): u for u in urls}
        for fut in cf.as_completed(futs):
            u = futs[fut]
            try:
                _, fname, size = fut.result()
                local_name[u] = fname
                ok += 1
            except Exception as e:  # noqa: BLE001
                fail[u] = f"{type(e).__name__}: {e}"
    print(f"[dl] 成功 {ok} 失败 {len(fail)}")
    for u, e in list(fail.items())[:10]:
        print("   FAIL", u[:90], e)

    # --- 回写 image ---
    upd = 0
    for u, qids in urls.items():
        fname = local_name.get(u)
        if not fname:
            continue
        for qid in qids:
            upd += conn.execute("UPDATE questions SET image=? WHERE id=?", (f"/qimg/{fname}", qid)).rowcount
    conn.commit()
    print(f"[db] image 本地化回写 {upd} 行")

    # --- 缺图题下架 ---
    if missing:
        ph = ",".join("?" * len(missing))
        conn.execute(f"UPDATE questions SET disabled=1 WHERE id IN ({ph})", missing)
        conn.commit()
        print(f"[db] 缺图题下架 {len(missing)} 题")

    # --- 卷内去重写回 ---
    for pid in dup_edit:
        ids = json.loads(conn.execute("SELECT question_ids FROM exam_papers WHERE id=?", (pid,)).fetchone()[0] or "[]")
        if not ids:
            continue
        ph = ",".join("?" * len(ids))
        qmap = {r["id"]: (r["question"], r["options"]) for r in conn.execute(
            f"SELECT id, question, options FROM questions WHERE id IN ({ph})", ids)}
        seen, kept = set(), []
        for qid in ids:
            q = qmap.get(qid)
            if q is None:
                kept.append(qid)
                continue
            k = (norm(q[0]), norm(q[1]))
            if len(k[0]) < 15:
                kept.append(qid)
                continue
            if k in seen:
                continue
            seen.add(k)
            kept.append(qid)
        conn.execute("UPDATE exam_papers SET question_ids=? WHERE id=?", (json.dumps(kept), pid))
    conn.commit()
    print(f"[db] 卷内去重 {len(dup_edit)} 卷已写回")


if __name__ == "__main__":
    main()
