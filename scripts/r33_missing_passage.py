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

# 引用篇章的表述；「文中」排除 古文中/铭文中/散文中 等词内误命中
PAT = re.compile(
    r"根据(以上)?文章|这篇文章|篇文章的节选|根据(本|短)文|适合作?(为)?(本文|上文)标题"
    r"|本文(没有|着重|主要|是|旨在)|填入文中|文中(画|划)|文中没有|文中提到"
)

c = sqlite3.connect(DB)
c.row_factory = sqlite3.Row
rows = c.execute(
    """SELECT id, module, question FROM questions
       WHERE (disabled IS NULL OR disabled=0) AND length(question) < 120"""
).fetchall()
hits = [r for r in rows if PAT.search(r["question"] or "")]
print("candidates:", len(hits))
for r in hits[:30]:
    print(r["id"], r["module"], (r["question"] or "")[:50])

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
