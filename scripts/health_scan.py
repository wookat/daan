"""全库周期性健康快扫（在生产容器内运行：sudo docker exec -i deploy-kaogong-1 python3 - < scripts/health_scan.py）

检查面：active/full 计数、质量分<50、options 非 JSON、(cid:) / U+FFFD 乱码、
hs 答案一致性（多选字母集合口径）、空 hs（预期仅 2 条台账题）、
OCR 推广文案残留（r84 清理后防回流）、卷内重复引用、近7天活跃、growth 台账。
"""
import sqlite3, re, json, time

DB = "/data/data.db"
INTENTIONAL_EMPTY_HS = {"changshi:655861", "panduan:334296"}
# r84 推广残留检测（题干/选项/解析/hs 命中即报，勿全局匹配「公众号」常规语义）
SPAM_PATTERNS = [
    re.compile(r"gwyeasy", re.I),
    re.compile(r"gwy288", re.I),
    re.compile(r"公众号：樱有尽有"),
    re.compile(r"获取[^，。]{0,6}更新，请关注公众号"),
]

c = sqlite3.connect(DB)
c.row_factory = sqlite3.Row
q = lambda s, *a: c.execute(s, a).fetchall()

print("active", q("SELECT COUNT(*) n FROM questions WHERE disabled IS NULL OR disabled=0")[0]["n"])
print("full", q("SELECT COUNT(*) n FROM questions")[0]["n"])
print("lt50", q("SELECT COUNT(*) n FROM questions WHERE (disabled IS NULL OR disabled=0) AND quality_score<50")[0]["n"])

badjson = cid = fffd = spam = 0
spam_ids = []
empty = []
pat = re.compile(r"故选\s*([A-D]+)|答案[为是选]\s*([A-D]+)|正确答案[为是]?\s*([A-D]+)")
mm = 0
for r in q("SELECT id,module,answer,question,options,explanation,hs_explanation FROM questions WHERE disabled IS NULL OR disabled=0"):
    try:
        o = json.loads(r["options"])
        if not isinstance(o, dict) or not o:
            badjson += 1
    except Exception:
        badjson += 1
    blob = (r["question"] or "") + (r["options"] or "") + (r["explanation"] or "") + (r["hs_explanation"] or "")
    if "(cid:" in blob:
        cid += 1
    if "\ufffd" in blob:
        fffd += 1
    if any(p.search(blob) for p in SPAM_PATTERNS):
        spam += 1
        spam_ids.append(r["id"])
    hs = r["hs_explanation"]
    if not hs or not hs.strip():
        key = r["module"] + ":" + str(r["id"])
        if key not in INTENTIONAL_EMPTY_HS:
            empty.append(key)
        continue
    m = pat.search(hs)
    if m:
        got = next(g for g in m.groups() if g)
        if sorted(set(got)) != sorted(set(r["answer"] or "")):
            mm += 1
print("badjson", badjson)
print("cid", cid)
print("fffd", fffd)
print("spam_residue", spam, spam_ids[:10])
print("hs_mismatch", mm)
print("empty_hs_beyond_ledger", len(empty), empty[:5])

dup = 0
lowcov = []
for r in q("SELECT id,question_ids FROM exam_papers"):
    arr = json.loads(r["question_ids"])
    if len(arr) != len(set(arr)):
        dup += 1
    ph = ",".join("?" * len(arr))
    a = q(f"SELECT COUNT(*) n FROM questions WHERE id IN ({ph}) AND (disabled IS NULL OR disabled=0)", *arr)[0]["n"]
    if arr and a / len(arr) < 0.6:
        lowcov.append((r["id"], len(arr), a))
print("paper_dup", dup)
print("paper_lowcov", lowcov)

# 引用篇章材料但题干过短（缺阅读材料，无法作答）——r33 下架治理后防回流（与 r33_missing_passage.py 同口径）
PASSAGE_PAT = re.compile(
    r"根据(以上)?文章|这篇文章|篇文章的节选|根据(本|短)文|适合作?(为)?(本文|上文)标题"
    r"|本文(没有|着重|主要|是|旨在)|填入文中|文中(画|划)|文中没有|文中提到"
)
missing_passage = [
    r["id"]
    for r in q("SELECT id, question FROM questions WHERE (disabled IS NULL OR disabled=0) AND length(question)<120")
    if PASSAGE_PAT.search(r["question"] or "")
]
print("missing_passage", len(missing_passage), missing_passage[:10])

now = int(time.time())
r7 = q("SELECT COUNT(*) n, COUNT(DISTINCT uid) u FROM answer_log WHERE created_at>?", now - 604800)[0]
print("last7d", (r7["n"], r7["u"]))
print("growth", [(x["event"], x["n"]) for x in q("SELECT event,COUNT(*) n FROM growth_events GROUP BY event ORDER BY n DESC LIMIT 12")])
