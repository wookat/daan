"""r33 治理：引用篇章材料但题干缺阅读材料的题（无法作答）下架留档。

在生产容器内运行：sudo docker exec -i deploy-kaogong-1 python3 - < scripts/r33_missing_passage.py [apply]
默认 dry-run 打印候选；传 apply 才写库（disabled=1 + note 留档）。
"""
import json
import re
import sqlite3
import sys
import time

DB = "/data/data.db"
APPLY = len(sys.argv) > 1 and sys.argv[1] == "apply"

# 引用篇章/材料的表述；「文中」排除 古文中/铭文中/散文中 等词内误命中（r33b 扩口径）
PAT = re.compile(
    r"根据(以上)?文章|这篇文章|篇文章的节选|根据(本|短)文|适合作?(为)?(本文|上文)标题"
    r"|本文(没有|着重|主要|是|旨在)|填入文中|文中(画|划)|文中没有|文中提到"
    r"|所给材料|这篇短文|续写并结束此文|原文的哪个位置"
    r"|第[一二三四五六七八九十1-9１-９①②③④⑤⑥⑦⑧⑨]段(的|中|里|末|首)"
    r"|(依据|根据|结合|填入)材料|材料[一二三四①②③④]([，。、中的]|提到|指出|认为|显示)"
    r"|作为?选文标题|选文(中|第|主要|意在|没有)"
)
# 篇章阅读子模块短题干一律视为缺材料（材料表不存在，题干装不下文章）
PIANZHANG_SQL = "submodule LIKE '%篇章%'"

c = sqlite3.connect(DB)
c.row_factory = sqlite3.Row
rows = c.execute(
    """SELECT id, module, question, submodule, material_hash FROM questions
       WHERE (disabled IS NULL OR disabled=0) AND length(question) < 120
         AND (material_hash IS NULL OR material_hash='')"""
).fetchall()
hits = [
    r for r in rows
    if "篇章" in (r["submodule"] or "") or PAT.search(r["question"] or "")
]
print("candidates:", len(hits))
for r in hits:
    why = "sub" if "篇章" in (r["submodule"] or "") else "pat"
    print(r["id"], r["module"], why, (r["question"] or "")[:50])

if APPLY:
    now = int(time.time())
    ids = [r["id"] for r in hits]
    for qid in ids:
        c.execute(
            "UPDATE questions SET disabled=1, note=COALESCE(note,'') || ?, updated_at=? WHERE id=?",
            (f"[r33]缺篇章阅读材料下架待补@{now};", now, qid),
        )
    c.commit()
    print("disabled:", len(ids))
    print(json.dumps(ids))
c.close()
