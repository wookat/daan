#!/usr/bin/env python3
"""题库离线分发包导出：从生产 SQLite（或其每日备份）生成不含任何用户数据的题库快照。

用法:
  python3 scripts/export_dataset.py --db /path/data.db --out dist/kaogong-bank-YYYYMMDD [--images-from URL|DIR]

产物（--out 目录）:
  questions.jsonl / .parquet        在库行测题（disabled=0），含考点、解析、真题元信息
  exam_papers.jsonl / .parquet      真题卷与模考卷（question_ids 引用 questions.id）
  shizheng_questions.jsonl/.parquet 时政每日一练
  shenlun_questions.jsonl/.parquet  申论真题
  shenlun_materials.jsonl/.parquet  申论素材/范文
  taxonomy.json                     行测三级考点树（tag3 编码释义）
  kaogong-bank.sqlite               同内容单文件 SQLite（便于直接 SQL 查询）
  qimg/                             题图（可选，--images-from）
  README.md                         data card（口径、字段、许可、校验）
  SHA256SUMS

不导出：answer_log/mistakes/users 等一切用户与行为数据、下架/待审题、内部批次与治理备注。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sqlite3
import sys
import urllib.request
from datetime import datetime, timezone

import pyarrow as pa
import pyarrow.parquet as pq

HERE = os.path.dirname(os.path.abspath(__file__))
TAXONOMY_SRC = os.path.join(HERE, "..", "backend", "app", "data", "taxonomy.json")

QUESTION_COLS = [
    "id",
    "module",
    "submodule",
    "question_type",
    "tag3",
    "question",
    "options",
    "answer",
    "explanation",
    "hs_explanation",
    "xp_explanation",
    "xp_school",
    "is_real",
    "exam_year",
    "exam_region",
    "source",
    "image",
    "image_credit",
    "quality_score",
    "updated_at",
]
QUESTION_SQL = (
    "SELECT "
    + ", ".join(QUESTION_COLS)
    + " FROM questions WHERE disabled=0 ORDER BY id"
)

TABLES: dict[str, str] = {
    "questions": QUESTION_SQL,
    "exam_papers": (
        "SELECT id, title, kind, year, region, question_ids, duration_min FROM exam_papers "
        "WHERE kind IN ('zhenti','mock') ORDER BY id"
    ),
    "shizheng_questions": (
        "SELECT id, date, question, options, answer, explanation, source_note "
        "FROM shizheng_questions ORDER BY id"
    ),
    "shenlun_questions": (
        "SELECT id, exam_year, exam_region, paper, qtype, material, question, reference, notes "
        "FROM shenlun_questions WHERE COALESCE(disabled,0)=0 ORDER BY id"
    ),
    "shenlun_materials": (
        "SELECT id, type, topic, content, source FROM shenlun_materials "
        "WHERE COALESCE(disabled,0)=0 ORDER BY id"
    ),
}
JSON_COLS = {"options", "question_ids"}


def _iso(ts: float | str | None) -> str | None:
    # 生产列混存 epoch 秒与 ISO 字串，统一为 UTC ISO-8601
    if ts is None or ts == "":
        return None
    if isinstance(ts, (int, float)):
        return datetime.fromtimestamp(ts, tz=timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
    return ts if ts.endswith("Z") else ts + "Z"


def _normalize(row: dict) -> dict:
    for k in JSON_COLS & row.keys():
        v = row[k]
        if isinstance(v, str) and v:
            try:
                row[k] = json.loads(v)
            except json.JSONDecodeError:
                pass
    if "updated_at" in row:
        row["updated_at"] = _iso(row["updated_at"])
    return row


def fetch(conn: sqlite3.Connection, sql: str) -> list[dict]:
    cur = conn.execute(sql)
    cols = [d[0] for d in cur.description]
    return [_normalize(dict(zip(cols, r))) for r in cur.fetchall()]


def write_jsonl(path: str, rows: list[dict]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(json.dumps(r, ensure_ascii=False) + "\n" for r in rows)


def write_parquet(path: str, rows: list[dict]) -> None:
    # JSON 列在 parquet 中保持为字符串，避免 dict 键集合不一致导致 schema 推断失败
    flat = [
        {
            k: (json.dumps(v, ensure_ascii=False) if k in JSON_COLS else v)
            for k, v in r.items()
        }
        for r in rows
    ]
    pq.write_table(pa.Table.from_pylist(flat), path, compression="zstd")


def write_sqlite(path: str, data: dict[str, list[dict]]) -> None:
    if os.path.exists(path):
        os.remove(path)
    out = sqlite3.connect(path)
    for table, rows in data.items():
        if not rows:
            continue
        cols = list(rows[0].keys())
        out.execute(f"CREATE TABLE {table} ({', '.join(cols)})")
        out.executemany(
            f"INSERT INTO {table} VALUES ({', '.join('?' * len(cols))})",
            [
                [
                    json.dumps(r[c], ensure_ascii=False) if c in JSON_COLS else r[c]
                    for c in cols
                ]
                for r in rows
            ],
        )
    out.execute("CREATE INDEX idx_q_module ON questions(module, submodule)")
    out.execute("CREATE INDEX idx_q_tag3 ON questions(tag3)")
    out.execute("CREATE INDEX idx_q_real ON questions(is_real, exam_year, exam_region)")
    out.commit()
    out.execute("VACUUM")
    out.close()


def copy_images(questions: list[dict], src: str, out_dir: str) -> int:
    dst = os.path.join(out_dir, "qimg")
    os.makedirs(dst, exist_ok=True)
    for q in questions:
        img = q.get("image")
        if not img:
            continue
        name = os.path.basename(img)
        target = os.path.join(dst, name)
        if os.path.exists(target):
            continue
        if src.startswith(("http://", "https://")):
            req = urllib.request.Request(
                src.rstrip("/") + img, headers={"User-Agent": "kaogong-export/1.0"}
            )
            with (
                urllib.request.urlopen(req, timeout=30) as resp,
                open(target, "wb") as f,
            ):
                shutil.copyfileobj(resp, f)
        else:
            shutil.copyfile(os.path.join(src, name), target)
    return len(os.listdir(dst))


def sha256sums(out_dir: str) -> None:
    lines = []
    for root, _, files in os.walk(out_dir):
        for fn in sorted(files):
            if fn == "SHA256SUMS":
                continue
            p = os.path.join(root, fn)
            h = hashlib.sha256()
            with open(p, "rb") as f:
                for chunk in iter(lambda: f.read(1 << 20), b""):
                    h.update(chunk)
            lines.append(f"{h.hexdigest()}  {os.path.relpath(p, out_dir)}")
    with open(os.path.join(out_dir, "SHA256SUMS"), "w") as f:
        f.write("\n".join(sorted(lines, key=lambda s: s.split("  ", 1)[1])) + "\n")


def data_card(data: dict[str, list[dict]], n_images: int, version: str) -> str:
    qs = data["questions"]
    by_module: dict[str, int] = {}
    for q in qs:
        by_module[q["module"]] = by_module.get(q["module"], 0) + 1
    real = sum(1 for q in qs if q["is_real"])
    papers = data["exam_papers"]
    zhenti = sum(1 for p in papers if p["kind"] == "zhenti")
    mod_lines = "\n".join(
        f"| {m} | {n:,} |" for m, n in sorted(by_module.items(), key=lambda x: -x[1])
    )
    return f"""# 考公行测题库快照 {version}

内部/合作方分发，**未经授权不得公开转发或商用**。许可：CC BY-NC 4.0（署名、非商业）。
导出时间（UTC）：{datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")}

## 规模

| 表 | 行数 |
|---|---|
| questions（行测在库题） | {len(qs):,}（真题 {real:,}） |
| exam_papers | {len(papers):,}（真题卷 {zhenti}，模考卷 {len(papers) - zhenti}） |
| shizheng_questions（时政） | {len(data["shizheng_questions"]):,} |
| shenlun_questions（申论真题） | {len(data["shenlun_questions"]):,} |
| shenlun_materials（申论素材） | {len(data["shenlun_materials"]):,} |
| qimg（题图） | {n_images} 张（{sum(1 for q in qs if q["image"]):,} 题引用） |

按模块：

| module | 题数 |
|---|---|
{mod_lines}

## 口径

- 只含 `disabled=0` 的在库题；历史下架、待审、重复簇治理下架题**不在其中**。
- 不含任何用户数据（作答、错题、账号、行为埋点）与内部治理字段（import_batch/note/material_hash 等）。
- `options` 为 `{{"A": "...", "B": "..."}}` 对象；`answer` 单选为单字母，多选为字母串（如 `ABD`）。
- `explanation` 为标准解析；`hs_explanation` 为花生十三体系讲解；`xp_explanation` 存在时为小P排除法讲解。
- `tag3` 为三级考点编码（如 `CS-DL-01`），释义见 `taxonomy.json`（module → group → topic）。
- `is_real=1` 表示真题，`exam_year`/`exam_region`/`source` 给出卷次；`image` 为题图相对路径，对应 `qimg/` 目录。
- `quality_score` 为内部质量评分（54–98），仅供筛选参考。
- `exam_papers.question_ids` 为 `questions.id` 数组，顺序即卷面题序。

## 文件

- `*.jsonl`：每行一题，UTF-8。
- `*.parquet`：zstd 压缩，JSON 列（options/question_ids）以字符串保存。
- `kaogong-bank.sqlite`：同内容单文件库，已建 module/tag3/真题索引。
- `SHA256SUMS`：`sha256sum -c SHA256SUMS` 校验完整性。

## 已知限制

- 约 {sum(1 for q in qs if not q["explanation"]):,} 题标准解析为空（讲解字段仍在）。
- 部分早期真题图形推理题图缺失，已在治理台账记录，不在本包补造。
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument(
        "--images-from",
        help="题图来源：站点 URL（如 https://kaogong.zalize.com）或本地 qimg 目录",
    )
    args = ap.parse_args()

    version = os.path.basename(os.path.normpath(args.out))
    os.makedirs(args.out, exist_ok=True)
    conn = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    data = {t: fetch(conn, sql) for t, sql in TABLES.items()}
    conn.close()

    for t, rows in data.items():
        write_jsonl(os.path.join(args.out, f"{t}.jsonl"), rows)
        write_parquet(os.path.join(args.out, f"{t}.parquet"), rows)
        print(f"{t}: {len(rows):,}", file=sys.stderr)
    write_sqlite(os.path.join(args.out, "kaogong-bank.sqlite"), data)
    shutil.copyfile(TAXONOMY_SRC, os.path.join(args.out, "taxonomy.json"))

    n_images = (
        copy_images(data["questions"], args.images_from, args.out)
        if args.images_from
        else 0
    )
    with open(os.path.join(args.out, "README.md"), "w", encoding="utf-8") as f:
        f.write(data_card(data, n_images, version))
    sha256sums(args.out)
    print(f"done -> {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
