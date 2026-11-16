#!/usr/bin/env python3
"""把 xt 真题仓库解析结果（xt.jsonl）导入题库并补全/新建真题卷。

流程：
1. repo 卷 = 6 个模块文件按目录前缀顺序（01政治→02常识→03言语→04数量→05判断→06资料）
   与题内编号合并成有序题列；<40 题的卷跳过（选调精选等碎卷不进卷库）。
2. 卷匹配：先按 (年份, 地区, 卷型) 规范键对本库 zhenti 卷；失败的按题干规范化哈希
   与单卷重合度 >=40% 兜底；都不中→新卷。
3. 题去重：规范化题干（去空白标点大小写）在本库 is_real 题池全局匹配，命中复用 qid，
   未中按题目插新行（import_batch 标记，has_hs=0 等 hs 解析管线）。
4. 图：题干/材料图取首张存 image=/qimg/<原文件名>，文件需已在 QIMG_DIR。
5. 更新已配卷的 question_ids（保留原 qid 使 answer_log/mistake 关联不断）；
   新卷 INSERT exam_papers（kind=zhenti）。

幂等：二次运行应 0 插入 0 更新（规范化题干命中即复用）。
用法：
    python backend/scripts/xt_zhenti_apply.py --xt /tmp/xt.jsonl --plan    # 只出匹配报告
    python backend/scripts/xt_zhenti_apply.py --xt /tmp/xt.jsonl --apply   # 实际写入
    DB_PATH=/data/data.db QIMG_DIR=/app/backend/qimg python ... --apply
"""
import argparse
import hashlib
import json
import os
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import db

MOD_DIR_ORDER = ["changshi", "yanyu", "shuliang", "panduan", "ziliao"]
# repo 目录前缀即考试模块顺序；政治理论/常识同归 changshi，故排序键用解析时的目录顺序写入
MODCN = {"changshi": "常识判断", "yanyu": "言语理解", "shuliang": "数量关系",
         "panduan": "判断推理", "ziliao": "资料分析"}
MIN_PAPER_Q = 40
VARIANTS = ["副省级", "地市级", "行政执法", "A类", "B类", "C类", "A卷", "B卷",
            "县级", "乡镇", "精选", "网友回忆版", "回忆版"]
PROVINCES = ["北京", "天津", "上海", "重庆", "河北", "山西", "辽宁", "吉林", "黑龙江",
             "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南",
             "广东", "海南", "四川", "贵州", "云南", "陕西", "甘肃", "青海", "内蒙古",
             "广西", "西藏", "宁夏", "新疆"]


def norm_text(s: str) -> str:
    """题干规范化哈希输入：去全部空白/标点/装饰，英文小写。"""
    s = re.sub(r"（材料\s*\d+）", "", s or "")
    return re.sub(r"[^\w一-鿿]", "", s).lower()


def norm_key(title: str):
    """卷名 → (year, region_key, variant_key) 规范键。"""
    t = title or ""
    y = re.search(r"(20\d{2}|19\d{2})", t)
    year = int(y.group(1)) if y else None
    if re.search(r"国家|国考", t):
        region = "guokao"
    else:
        region = next((p for p in PROVINCES if p in t), "")
    variant = "+".join(v for v in VARIANTS if v in t)
    return (year, region, variant)


def duration_for(n: int) -> int:
    if n >= 120:
        return 120
    return max(30, min(120, int(-(-n * 0.9 // 5) * 5)))


def region_of(title: str, region_field: str):
    """exam_papers.region：国考→None，省考→省名（去后缀）。"""
    if re.search(r"国家|国考", title):
        return None
    for p in PROVINCES:
        if p in title or p in (region_field or ""):
            return p
    return (region_field or None)


def clean_stem(s: str) -> str:
    """去掉 repo 判断题残留的 `-（选项）[]` 占位标记（须在 norm_text 之前做）。"""
    return re.sub(r"-\s*（选项）\[\]", "", s or "").rstrip()


def load_xt(path: str):
    """按卷聚合 → {paper: [q...]}（已按 目录顺序×题号 排序的 jsonl 原序即正确顺序）。"""
    papers: dict[str, list[dict]] = defaultdict(list)
    for line in open(path, encoding="utf-8"):
        q = json.loads(line)
        q["stem"] = clean_stem(q["stem"])
        papers[q["paper"]].append(q)
    return papers


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--xt", required=True, help="xt_zhenti_parse.py 输出 jsonl")
    ap.add_argument("--qimg", default=os.environ.get("QIMG_DIR", ""), help="本库 qimg 目录")
    ap.add_argument("--xt-img", default="", help="xt 仓库 90-图片/题目图 目录（查缺图片用）")
    ap.add_argument("--plan", action="store_true")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    xt = load_xt(args.xt)
    print(f"xt 卷 {len(xt)} 套 / {sum(len(v) for v in xt.values())} 题")
    db.init_db()
    conn = db.get_conn()
    db._ensure_exam_tables(conn)

    # 本库题池：规范化题干 → qid 列表（is_real，含 disabled=0 与 disabled IS NULL）
    norm2qid: dict[str, list[int]] = defaultdict(list)
    qrow = {}
    for r in conn.execute(
        "SELECT id, question, source FROM questions WHERE is_real=1 AND (disabled IS NULL OR disabled=0)"
    ):
        qrow[r["id"]] = r["source"]
        norm2qid[norm_text(r["question"])].append(r["id"])
    print(f"本库 is_real 题池 {len(qrow)}")

    # 本库 zhenti 卷
    papers_db = {
        r["id"]: dict(r) for r in conn.execute(
            "SELECT id,title,year,region,question_ids FROM exam_papers WHERE kind='zhenti'"
        )
    }
    for p in papers_db.values():
        p["qids"] = json.loads(p["question_ids"] or "[]")
    key2pid = {}
    for pid, p in papers_db.items():
        key2pid.setdefault(norm_key(p["title"]), []).append(pid)
    # 本库每卷 → 规范化题干集（重合度匹配用）
    qid2norm: dict[int, str] = {
        r["id"]: norm_text(r["question"]) for r in conn.execute(
            "SELECT id, question FROM questions WHERE is_real=1 AND (disabled IS NULL OR disabled=0)"
        )
    }
    for p in papers_db.values():
        p["_norms"] = {qid2norm[i] for i in p["qids"] if i in qid2norm}

    stats = Counter()
    cands = []  # (ratio, key_hit, title, qs, pid)
    for title, qs in sorted(xt.items(), key=lambda kv: -len(kv[1])):
        if len(qs) < MIN_PAPER_Q:
            stats["skip_small"] += 1
            continue
        key = norm_key(title)
        qset = {norm_text(q["stem"]) for q in qs if q["stem"]}
        best_pid, best_ratio = None, 0.0
        for ppid, p in papers_db.items():
            if not p["_norms"]:
                continue
            ratio = len(qset & p["_norms"]) / len(qset)
            if ratio > best_ratio:
                best_pid, best_ratio = ppid, ratio
        pid = best_pid if best_ratio >= 0.4 else None
        cands.append((best_ratio, bool(key2pid.get(key)), title, key, pid, qs))
    # pid 争用仲裁：重合度高的 repo 卷认领本库卷，败者转新卷
    claimed: set[int] = set()
    plan = []
    for ratio, key_hit, title, key, pid, qs in sorted(cands, key=lambda c: -c[0]):
        if pid is not None and pid in claimed:
            pid = None
        if pid is not None:
            claimed.add(pid)
        plan.append((title, len(qs), key, pid, f"{ratio:.0%}" + ("+key" if key_hit else ""), qs))
    new_papers = 0
    for title, n, key, pid, how, qs in plan:
        tag = f"→ pid={pid} ({how})" if pid else "→ 新卷"
        if not pid:
            new_papers += 1
        print(f"{n:>4} {title[:58]} {tag}")
    print(f"\n计划：补全 {len(plan)-new_papers} 卷 / 新建 {new_papers} 卷 / 跳过碎卷 {stats['skip_small']} 套")
    if not args.apply:
        # 顺带输出「将插入题所需图片」清单：未命中去重且有图的题的首图文件名
        need: set[str] = set()
        for title, n, key, pid, how, qs in plan:
            for q in qs:
                if not q["images"]:
                    continue
                if not norm2qid.get(norm_text(q["stem"])):
                    need.add(q["images"][0].split("/")[-1])
        with open("/tmp/xt_needed_imgs.txt", "w") as f:
            f.write("\n".join(sorted(need)))
        print(f"需上传图片 {len(need)} 张 → /tmp/xt_needed_imgs.txt")
        return

    batch = f"xt-{__import__('time').strftime('%Y%m%d')}"
    inserted = reused = skipped = imgs_copied = imgs_missing = 0
    updated_papers = new_ids = 0
    missing_img_files: set[str] = set()

    def find_existing(q):
        for cand in norm2qid.get(norm_text(q["stem"]), []):
            return cand
        return None

    def insert_q(conn, q, paper_title, year, region):
        nonlocal imgs_copied, imgs_missing
        stem = q["stem"]
        if q["material"]:
            stem = f"(材料 {q['mat_no']}){q['material']}\n{stem}" if q.get("mat_no") else f"{q['material']}\n{stem}"
        options = q["options"] or {}
        if not options and q["answer"] in ("A", "B"):
            options = {"A": "正确", "B": "错误"}
        if not options:
            return None
        # question 列 UNIQUE：先查同文行，避免 IntegrityError 触发 _ConnProxy 整事务回滚。
        # 命中行按状态分流：活跃题复用；is_real=0 活跃题提升为真题；disabled/pending 行不复活、跳过。
        dup = conn.execute(
            "SELECT id, is_real, disabled FROM questions WHERE question=?", (stem,)
        ).fetchone()
        if dup:
            if dup["disabled"] not in (None, 0):
                stats["skip_disabled"] += 1
                return None
            if not dup["is_real"]:
                conn.execute(
                    "UPDATE questions SET is_real=1, exam_year=?, exam_region=?, source=?, import_batch=? WHERE id=?",
                    (int(year) if str(year).isdigit() else None, region, paper_title, batch, dup["id"]),
                )
                stats["promoted"] += 1
            else:
                stats["dup_active"] += 1
            return dup["id"]
        image = None
        if q["images"]:
            fn = q["images"][0].split("/")[-1]
            src_img = os.path.join(args.xt_img, fn) if args.xt_img else ""
            dst = os.path.join(args.qimg, fn) if args.qimg else ""
            if dst and os.path.exists(src_img):
                if not os.path.exists(dst):
                    import shutil
                    shutil.copyfile(src_img, dst)
                    imgs_copied += 1
                image = f"/qimg/{fn}"
            else:
                imgs_missing += 1
                missing_img_files.add(fn)
        mat_hash = hashlib.md5(norm_text(q["material"]).encode()).hexdigest() if q["material"] else None
        cur = conn.execute(
            """INSERT INTO questions
               (module, question_type, question, options, answer, explanation, source,
                submodule, is_real, exam_year, exam_region, disabled, import_batch,
                image, material_hash, tag3, quality_score, has_hs)
               VALUES (?,?,?,?,?,?,?,?,1,?,?,0,?,?,?,NULL,NULL,0)""",
            (q["mod"], f"{MODCN[q['mod']]}-{q['subtype'] or MODCN[q['mod']]}",
             stem, json.dumps(options, ensure_ascii=False), q["answer"],
             q["explanation"], paper_title, q["subtype"] or None,
             int(year) if str(year).isdigit() else None, region,
             batch, image, mat_hash),
        )
        return cur.lastrowid

    for title, n, key, pid, how, qs in plan:
        year = key[0]
        region = region_of(title, qs[0].get("region"))
        final_qids: list[int] = []
        seen_ids: set[int] = set()
        for q in qs:
            if not q["options"] and q["answer"] not in ("A", "B"):
                skipped += 1
                continue
            ex = find_existing(q)
            if ex:
                stats["reuse"] += 1
                qid = ex
            else:
                qid = insert_q(conn, q, title, year, region)
                if qid is None:
                    skipped += 1
                    continue
                inserted += 1
                norm2qid[norm_text(q["stem"])].append(qid)
            if qid in seen_ids:
                continue
            seen_ids.add(qid)
            final_qids.append(qid)
        if pid:
            old = papers_db[pid]["qids"]
            if final_qids != old:
                conn.execute(
                    "UPDATE exam_papers SET question_ids=? WHERE id=?",
                    (json.dumps(final_qids), pid),
                )
                updated_papers += 1
        else:
            t = title[:80]
            dup = conn.execute("SELECT id FROM exam_papers WHERE title=?", (t,)).fetchone()
            if dup:
                conn.execute(
                    "UPDATE exam_papers SET question_ids=?, kind='zhenti', year=?, region=? WHERE id=?",
                    (json.dumps(final_qids), year, region, dup["id"]),
                )
                updated_papers += 1
            else:
                conn.execute(
                    """INSERT INTO exam_papers (title, kind, year, region, question_ids, duration_min, created_at)
                       VALUES (?,?,?,?,?,?,?)""",
                    (t, "zhenti", year, region, json.dumps(final_qids),
                     duration_for(len(final_qids)), __import__("time").time()),
                )
                new_ids += 1
        conn.commit()  # 每卷一提交：异常只丢当前卷，不整批回滚
    conn.commit()
    conn.close()
    db._papers_cache.clear()
    print(f"\n完成：新题 +{inserted} | 复用 {stats['reuse']} | 跳过 {skipped} | "
          f"补全更新 {updated_papers} 卷 | 新建 {new_ids} 卷 | "
          f"图落地 {imgs_copied} 缺 {imgs_missing}")
    if missing_img_files:
        print("缺图文件示例：", sorted(missing_img_files)[:10])


if __name__ == "__main__":
    main()
