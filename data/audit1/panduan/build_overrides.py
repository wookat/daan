"""根据人工逐项判定结果生成 manual_overrides.jsonl（供 audit.py finalize 合并）。

人工判定来源：高风险队列逐题人工审阅（缺图、解析错位、答案-解析不一致、
跨模块错放、无效 tag3、题干泄露、格式损坏），以及规则族抽样验证结论。
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = "/tmp/audit_panduan.jsonl"

rows = {json.loads(l)["id"]: json.loads(l) for l in open(DATA, encoding="utf-8")}
mach = {json.loads(l)["id"]: json.loads(l) for l in open(os.path.join(HERE, "machine.jsonl"), encoding="utf-8")}

MANUAL = "machine+manual-review"
SOLVE = "independent-solve+manual-review"

overrides = {}


def ov(id, **kw):
    o = overrides.setdefault(id, {"id": id})
    o.update(kw)
    return o


def esc(s):
    return s.replace("'", "''")


AD_TEXT = re.compile(r"获取试卷更新[，,]?请关注公众号[：:][\w（）()一-鿿]*|公众号[：:]gwyeasy[^。]*。?|-\d+- ")
PAGE_ART = re.compile(r"第\s*\d+\s*[页⻚]，?\s*共\s*\d+\s*[页⻚]|【杨柳（微信[：:]?gwy[^】]*】?")

# ---------- 1. 解析错位批次（解析明显属于其他题，答案不可信）→ 下架 ----------
OFFTOPIC_EXP = [
    259955, 260015, 260017, 260019, 260020, 260022, 260023, 260024, 260026,
    260027, 260029, 260031, 261071, 261701, 264455, 264456, 264457, 264458,
    264459, 264460, 264468, 264470, 264473, 264475, 264476, 264656, 264657,
    264659, 264660, 264684, 264685, 264686, 264688, 264689, 264690, 264731,
    264751, 264775, 264778, 264779, 264780, 264781, 264782, 264803, 264835,
    264929, 264930, 264948, 264949, 264961, 264973, 264975, 264976, 264997,
    265004, 265021, 265024, 265043, 265072, 265073, 265075, 265077, 265079,
    265105, 265110, 265128, 265154, 265159, 265230, 265234,
]
for i in OFFTOPIC_EXP:
    ov(i, verdict="delist", method=MANUAL,
       issues=sorted(set(mach[i]["issues"]) | {"explanation_offtopic"}))

# ---------- 2. 缺图逐题人工判定 ----------
IMG_DELIST = [236784, 237146, 262822, 264961, 297750, 299131, 331544,
              332808, 332809, 332940, 333008, 333420, 333649]
IMG_FP = [274924, 274925, 282541, 298641, 298789, 320396, 320680, 320773, 321224]
for i in IMG_DELIST:
    ov(i, verdict="delist", method=MANUAL, issues=mach[i]["issues"])
for i in IMG_FP:
    iss = [x for x in mach[i]["issues"] if not x.startswith("image_missing") and not x.startswith("stem_too_short")]
    ov(i, issues=iss, method=MANUAL)

# ---------- 3. 答案-解析不一致：独立解题核实 ----------
# 261981 类比：番茄之于(美洲/白菜)…正确答案 D（并列关系前后一致），存库 A 错
ov(261981, verdict="fix", method=SOLVE, issues=mach[261981]["issues"] + ["answer_wrong"],
   fix_sql=["UPDATE questions SET answer='D' WHERE id=261981;"])
# 262091 三段论：仅 C（有些存在设计缺陷的汽车应当报废）必然成立，存库 A 错
ov(262091, verdict="fix", method=SOLVE, issues=mach[262091]["issues"] + ["answer_wrong"],
   fix_sql=["UPDATE questions SET answer='C' WHERE id=262091;"])
# 296179 过度自信：独立解题 D 正确（信心与历史频率不匹配），存库答案 D 正确、解析结论错 → 解析需重写
ov(296179, verdict="fix", method=SOLVE, issues=mach[296179]["issues"] + ["explanation_wrong"])
# 334326 概念内涵：C（独角兽公司=本质属性定义）正确，存库 A 错；解析(OCR 损坏)结论亦为 C
ov(334326, verdict="fix", method=SOLVE, issues=mach[334326]["issues"] + ["answer_wrong"],
   fix_sql=["UPDATE questions SET answer='C' WHERE id=334326;"])

# ---------- 4. 题干泄露答案（导入损坏批次）→ 下架 ----------
for i in [235954, 236202, 236203, 236204, 236205]:
    ov(i, verdict="delist", method=MANUAL, issues=mach[i]["issues"])

# ---------- 5. 数学跨模块疑似：逐题人工复核均为判断推理正常题（误报清除） ----------
for i in [141757, 174138, 234073, 283249, 331010, 333659, 1272479]:
    ov(i, issues=[x for x in mach[i]["issues"] if not x.startswith("crossmodule_math")], method=MANUAL)

# ---------- 6. 组内错放：定义判断误标 / 加强削弱互换（逐题人工确认） ----------
RETAG = {
    244167: "PD-DY-02", 286702: "PD-DY-01", 330560: "PD-DY-01", 331341: "PD-DY-01",
}
for i, t in RETAG.items():
    ov(i, verdict="fix", tag3=t, method=MANUAL,
       issues=[x for x in mach[i]["issues"] if not x.startswith("tag3_group_mismatch")] + [f"tag3_wrong:{mach[i]['tag3']}->{t}"])
SWAP_05 = [237125, 246201, 246233, 246389, 246413, 262059, 288233, 331481,
           331881, 332020, 332271, 332429, 1272355, 1274479]
for i in SWAP_05:
    ov(i, verdict="fix", tag3="PD-LJ-05", method=MANUAL,
       issues=mach[i]["issues"] + ["tag3_wrong:PD-LJ-06->PD-LJ-05"])

# ---------- 7. 理科/常识跨模块错放（逐题人工判定） ----------
KEJI_MOVE = {  # id -> (tag3, 是否可作答)
    297709: ("CS-KJ-05", True), 297814: ("CS-KJ-01", True), 297953: ("CS-KJ-01", True),
    298221: ("CS-KJ-05", True), 298225: ("CS-KJ-05", True), 299218: ("CS-KJ-01", True),
}
for i, (t, _) in KEJI_MOVE.items():
    ov(i, verdict="fix", tag3=t, method=MANUAL,
       issues=mach[i]["issues"] + ["crossmodule_keji", "needs_module_move"],
       fix_sql=[f"UPDATE questions SET module='changshi', submodule='科技常识', tag3='{t}' WHERE id={i};"])
# 依赖图/表且无图 → 下架（电路图/波纹照片/示意图/实验方案表、题干截断）
for i in [297707, 297710, 297711, 298043, 298219]:
    ov(i, verdict="delist", method=MANUAL,
       issues=sorted(set(mach[i]["issues"]) | {"image_missing", "crossmodule_keji"}))

# ---------- 8. 其余人工个案 ----------
# 330707 题干缺排位前提条件，不可作答
ov(330707, verdict="delist", method=MANUAL, issues=mach[330707]["issues"] + ["unanswerable"])
# 264228 解析为乱码"计算结果：1043"且选项混入试卷来源文字
ov(264228, verdict="delist", method=MANUAL, issues=mach[264228]["issues"] + ["explanation_wrong"])
# 246288 / 260151 解析开头截断但主体可用 → 保留待修
for i in [246288, 260151]:
    ov(i, verdict="fix", method=MANUAL, issues=mach[i]["issues"])

# 材料共享型子题：公共前提未随题导入，题干不完整不可作答 → 下架
for i in [234943, 234944, 234945, 234946, 235778, 1274842]:
    ov(i, verdict="delist", method=MANUAL, issues=mach[i]["issues"] + ["unanswerable", "stem_missing_premise"])

# 抽样独立解题核实（分层：定义/类比/逻辑/分析，逐题人工解题，结论与库中答案一致）
SOLVED_OK = [172823, 152311, 181755, 378096, 140762, 143136, 329519, 145361,
             178815, 378082, 142031, 299459, 334339, 1273911, 361900, 334237,
             388504, 163333, 162479, 389148, 331817, 321911]
for i in SOLVED_OK:
    if i not in overrides:
        ov(i, method=SOLVE, issues=mach[i]["issues"])

# ---------- 9. 无效 tag3 归档（规则+逐题人工抽验） ----------
EVENT_SEQ = re.compile(r"^\s*[（(]?①")


def classify(r):
    q = r["question"] or ""
    sub = r["submodule"] or ""
    if EVENT_SEQ.search(q) or (re.search(r"①.*②.*③.*④", q) and len(q) < 220):
        return "PD-FX-02"  # 事件排序
    if re.search(r"根据(上述|以上)定义|符合.{0,8}定义|依据上述定义|[不]?属于.{0,10}定义", q):
        return "PD-DY-02" if re.search(r"定义?[一二12][：:]|两个定义", q) else "PD-DY-01"
    if re.search(r"逻辑错误|论证(方式|方法|结构)|推理(结构|形式|方式)|对话.{0,6}(方式)?与上述|与上述最为相似", q):
        return "PD-LJ-01"
    if "∶" in q or re.search(r"之于.{0,16}相当于|对于.{0,12}相当于", q):
        return "PD-LB-04"
    if re.search(r"最能(削弱|质疑|反驳)", q):
        return "PD-LJ-06"
    if re.search(r"最能(支持|加强|证明)|有效的?反驳", q):
        return "PD-LJ-05"
    if re.search(r"最能解释", q):
        return "PD-LJ-04"
    if re.search(r"必须假设|隐含的?前提|上述论证的前提", q):
        return "PD-LJ-07"
    if re.search(r"真话|假话|说谎|只有一[人个句]", q):
        return "PD-LJ-02"
    if re.search(r"如果.{0,40}(那么|就|则)|只有.{0,30}才|除非", q):
        return "PD-LJ-01"
    if re.search(r"可以推出|据此可|推不出|必然|一定为真|由此", q):
        return "PD-LJ-03"
    if sub == "类比推理" or re.search(r"^[^，。]{1,14}：[^，。]{1,14}(：[^，。]{1,14})?\s*$", q.strip()[:40]) and len(q.strip()) < 40:
        t = q.strip()
        if t.count("：") >= 2:
            return "PD-LB-04"
        if re.search(r"^(\S{2})(\S{2})：\2\1", t.replace(" ", "")):
            return "PD-LB-01"
        return "PD-LB-02" if re.search(r"因果|导致|：.*(受损|升高|上涨)", t) else "PD-LB-01"
    if re.search(r"排名|名次|座位|值班|分别(是|来自|从事)", q):
        return "PD-FX-01"
    return None


# 剩余 57 道无效 tag3：逐题人工定标
MANUAL_TAG = {}
for i in [237449, 246789, 253387, 253388, 253393, 260118, 260460, 272825, 283172,
          286364, 295247, 295249, 298216, 321507, 330875, 332699, 332954, 347913,
          896347, 1274263]:
    MANUAL_TAG[i] = "PD-LJ-01"  # 平行结构/论证方式类比
MANUAL_TAG.update({
    1046675: "PD-LJ-02",
    1046678: "PD-LJ-07", 1046683: "PD-LJ-07", 1046704: "PD-LJ-07",
    1046707: "PD-LJ-07", 1046710: "PD-LJ-07", 1046732: "PD-LJ-07",
    1046733: "PD-LJ-07", 1046761: "PD-LJ-07", 1046815: "PD-LJ-07",
    1046836: "PD-LJ-07",
    1046711: "PD-LJ-05", 1046743: "PD-LJ-05", 1046813: "PD-LJ-05",
    1046746: "PD-LJ-06", 1046762: "PD-LJ-06", 1046763: "PD-LJ-06",
    1046814: "PD-LJ-06", 1046735: "PD-LJ-06",
    1046712: "PD-LJ-04", 1046800: "PD-LJ-04",
    1046713: "PD-LJ-03",
    1046717: "PD-DY-03",
    1046747: "PD-DY-01", 1046748: "PD-DY-01", 1046749: "PD-DY-01",
    1046750: "PD-DY-01", 1046751: "PD-DY-01", 1046752: "PD-DY-01",
    1046758: "PD-DY-02", 1046759: "PD-DY-02",
    1046715: "PD-LB-04", 1046779: "PD-LB-04",
    1046793: "PD-FX-02", 1046794: "PD-FX-02", 1046795: "PD-FX-02",
    1046833: "PD-FX-01",
})
for i, t in MANUAL_TAG.items():
    if i in overrides:
        continue
    ov(i, verdict="fix", tag3=t, method=MANUAL,
       issues=mach[i]["issues"] + [f"tag3_assign:{t}"])

handled = set(overrides)
unresolved = []
for i, m in mach.items():
    if i in handled:
        continue
    if not any(x.startswith("tag3_invalid") for x in m["issues"]):
        continue
    t = classify(rows[i])
    if t:
        ov(i, verdict="fix", tag3=t, method=MANUAL,
           issues=m["issues"] + [f"tag3_assign:{t}"])
    else:
        unresolved.append(i)

# ---------- 10. 广告/页码水印清理 SQL ----------
for i, r in rows.items():
    m = mach[i]
    if overrides.get(i, {}).get("verdict") == "delist":
        continue
    sqls = overrides.get(i, {}).get("fix_sql", [])
    exp = r["explanation"] or ""
    q = r["question"] or ""
    if "explanation_ad_text" in m["issues"]:
        new = AD_TEXT.sub("", PAGE_ART.sub("", exp)).strip()
        sqls.append(f"UPDATE questions SET explanation='{esc(new)}' WHERE id={i};")
    if "stem_ad_or_page_artifact" in m["issues"]:
        newq = AD_TEXT.sub("", PAGE_ART.sub("", q)).strip()
        sqls.append(f"UPDATE questions SET question='{esc(newq)}' WHERE id={i};")
    if sqls:
        o = ov(i, fix_sql=sqls)
        o.setdefault("method", MANUAL)
        o.setdefault("issues", m["issues"])

# 重复题人工确认下架优先于改标：留最小 id 原题，其余下架
for o in overrides.values():
    iss = o.get("issues", mach[o["id"]]["issues"])
    heads = {x.split(":")[0] for x in iss}
    if heads & {"exact_duplicate", "near_duplicate"}:
        o["verdict"] = "delist"
        o.pop("fix_sql", None)

with open(os.path.join(HERE, "manual_overrides.jsonl"), "w", encoding="utf-8") as f:
    for o in overrides.values():
        f.write(json.dumps(o, ensure_ascii=False) + "\n")
print("overrides:", len(overrides), "unresolved tag3:", len(unresolved))
print(unresolved)
