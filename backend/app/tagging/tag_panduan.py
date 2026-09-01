#!/usr/bin/env python3
"""判断推理模块三级考点规则打标脚本（人工归纳规则，无外部 LLM）。

用法:
  python3 tag_panduan.py --untagged ../untagged_panduan.jsonl --out ../tagged_panduan.jsonl

规则设计说明见 ../report_panduan.md。
"""
import argparse
import json
import re
from collections import Counter


def text_of(r):
    return (r.get("question") or "") + "\n" + (r.get("explanation") or "")


# ---------- 污染题检测：混入判断推理数据中的数学应用题（应属数量关系） ----------
MATH_PAT = re.compile(
    r"(一批.{0,12}按每.{0,8}(分装|正好)|可以分装多少|上午卖出.{0,20}下午卖出|"
    r"共卖出.{0,10}多少|共有\d+.{0,60}多少|多少(箱|包|匣|份|个|斤|块|件|颗|袋|台|辆|把|条|张|支)？)"
)
MATH_EXP_PAT = re.compile(r"验算[：:].{0,40}[=＝✓]")


def is_math_contamination(r):
    q = r.get("question") or ""
    e = r.get("explanation") or ""
    if MATH_PAT.search(q):
        return True
    # 题干是纯算术叙述且解析是算式验算
    if MATH_EXP_PAT.search(e) and re.search(r"[＝=][0-9０-９]", e) and "多少" in q:
        if not re.search(r"(推出|定义|逻辑|规律|排列|对应|甲|乙|丙|丁)", q):
            return True
    return False


# ---------- 图形推理 PD-TX ----------
def classify_tuxing(q, e, t):
    if re.search(r"(分为两类|分组分类|每一类图形)", q) or re.search(r"汉字", t):
        return "PD-TX-06", 0.9
    if re.search(r"(展开图|折成|折叠|纸盒|三视图|截面|立体|正方体|六面体|拼合|拼接|拼成)", t):
        return "PD-TX-05", 0.9
    if re.search(r"(叠加|求同|求异|黑白运算|去同存异|遍历)", t):
        return "PD-TX-02", 0.85
    if re.search(r"(对称|曲直性|曲直规律|开放图形|开闭|曲线图形在上|直线图形在上|全是直线图形|全是曲线图形)", t):
        return "PD-TX-03", 0.8
    if re.search(r"(平移|旋转|翻转|顺时针|逆时针|移动.{0,4}(格|步)|位置规律|位置变化|位置关系)", t):
        return "PD-TX-01", 0.85
    if re.search(r"(封闭空间|封闭区域|线条数|笔画|奇点|交点|面的数量|数量规律|个数|曲线数|条曲线|条直线|边数|元素种类|数量.{0,4}(变化|规律))", t):
        return "PD-TX-04", 0.8
    return "UNKNOWN", 0.0


# ---------- 定义判断 PD-DY ----------
DEF_TERM = re.compile(r"([^\s，。；：、]{2,16})(?:：指|:指|是指|，是指|，指|指的是|：是指)")


def classify_dingyi(q, e, t):
    terms = set(DEF_TERM.findall(q))
    if re.search(r"原则", "".join(terms)) or re.search(r"^.{0,30}原则[：:]", q):
        return "PD-DY-03", 0.75
    if len(terms) >= 2 or re.search(r"划分为|分为.{0,10}(两|三|几)(个|种|类|层次)", q):
        return "PD-DY-02", 0.85
    if re.search(r"根据上述定义|依据上述定义|根据以上定义|下列(最能)?(不)?(属于|体现|符合)", q):
        return "PD-DY-01" if len(terms) <= 1 else "PD-DY-02", 0.85
    if terms:
        return "PD-DY-01", 0.75
    if re.search(r"(定义关键词|题干关键词|单定义|考查.{0,8}定义)", e):
        return "PD-DY-01", 0.7
    return "UNKNOWN", 0.0


# ---------- 类比推理 PD-LB ----------
LB_PATS = [
    ("PD-LB-01", re.compile(r"(近义|反义|比喻|象征|词义相近|意思相近|意思相反|引申义|典故)")),
    ("PD-LB-02", re.compile(r"(全同|并列|包容|种属|组成关系|交叉关系|反对关系|矛盾关系|文氏图|集合关系)")),
    ("PD-LB-03", re.compile(r"(主谓|动宾|偏正|语法关系|造句)")),
    ("PD-LB-04", re.compile(r"(功能对应|原材料|方式目的|场所对应|时间顺序|工艺|对应关系|工具对应|因果对应|属性对应|的工具|用于|功能|作用对象|因果关系)")),
]


def _lb_first_hit(text):
    hits = []
    for code, pat in LB_PATS:
        m = pat.search(text)
        if m:
            hits.append((m.start(), code))
    if hits:
        hits.sort()
        return hits[0][1]
    return None


def classify_leibi(q, e, t):
    # 代入型解析（“逐一代入选项”）：题干关系在“逻辑关系一致（当选/符合）”
    # 的选项段落里，取该处附近的关系词
    if re.search(r"(逐一代入|分别将选项代入|代入排除|代入选项|分别代入|逐一代六选项)", e):
        # 按选项分段，取“逻辑关系一致（当选/符合）”的选项段落内的关系词
        segs = re.split(r"[A-DＡ-Ｄａ-ｄ][项）\)][：:，]?", e)
        for seg in segs[1:]:
            if re.search(r"(?<!不)一致[，。、]?\s*(当选|符合|保留|正确)", seg):
                code = _lb_first_hit(seg)
                if code:
                    return code, 0.8
        return "UNKNOWN", 0.0
    # 非代入型解析先陈述题干（正确答案）关系，再逐项排除：取最先出现的关系类别
    code = _lb_first_hit(e)
    if code:
        return code, 0.85
    code = _lb_first_hit(q)
    if code:
        return code, 0.8
    # 本数据集大量 AI 生成题，解析呈“均为“A:B:C””的三元对应结构 → 对应关系
    if re.search(r"均为[“\"『][^”\"』]{2,40}[:：][^”\"』]{1,40}[”\"』]", e):
        return "PD-LB-04", 0.8
    # 流程环节先后顺序 → 时间顺序对应
    if re.search(r"(依次进行的环节|先后顺序|工序|流程.{0,6}(顺序|环节)|顺序均颠倒)", e):
        return "PD-LB-04", 0.85
    # 典故/成语喻义 → 语义关系（比喻象征义）
    if re.search(r"(典故|喻|含义对应|词义)", e):
        return "PD-LB-01", 0.8
    # 解析描述为“X+Y+Z 对应”的其他对应结构
    if re.search(r"(对应一致|对应。|关系一致|关系错配)", e):
        return "PD-LB-04", 0.7
    return "UNKNOWN", 0.0


# ---------- 逻辑判断 PD-LJ ----------
ASSIGN_PAT = re.compile(
    r"(分别(负责|教|担任|从事|选择)|每人一(项|处|岗|科)|一人一科|互不相同)"
)


def classify_luoji(q, e, t):
    # 人员-任务分配题：内容实为分析推理-信息匹配（见报告说明）
    if ASSIGN_PAT.search(q) and re.search(r"(甲|乙|丙|小\w|赵|钱|孙)", q):
        return "PD-FX-01", 0.85
    if re.search(r"(削弱|质疑|反驳|驳斥|不能支持)", q):
        return "PD-LJ-06", 0.9
    if re.search(r"(前提|假设)", q):
        return "PD-LJ-07", 0.9
    if re.search(r"(加强|支持|证明上述|最能证明)", q):
        return "PD-LJ-05", 0.9
    if re.search(r"(解释上述|最能解释|如何解释|矛盾的现象)", q):
        return "PD-LJ-04", 0.9
    if re.search(r"(只有一(人|句|个)(说的?)?(是真|真话|属实)|说真话|说假话|说谎|一真一假|两真两假|其中只有)", t):
        return "PD-LJ-02", 0.85
    cond = re.search(
        r"(如果.{1,40}(那么|就|则)|只有.{1,40}才|只要.{1,40}就|若.{1,30}则|"
        r"除非.{1,40}否则|必须(确认|完成|穿|佩戴|通过|持有|系挂)|只有持有|只有通过|所有(通过|参与|参加))", q)
    if cond and re.search(r"(可以推出|能够推出|由此推出|推不出|一定为真|必然|必定为真)", q):
        return "PD-LJ-01", 0.9
    if re.search(r"(逆否|充分条件|必要条件|德摩根|翻译推理|前推后|否后)", e):
        return "PD-LJ-01", 0.85
    # 直言命题矛盾（有的/所有 + 必然为假/为真）→ 翻译推理（集合推理）
    if re.search(r"(有的|有些|所有|凡是)", q) and re.search(r"(必然为假|必然为真|必定为假)", q):
        return "PD-LJ-01", 0.75
    if re.search(r"矛盾命题", e):
        return "PD-LJ-01", 0.7
    if re.search(r"否(定)?.{0,6}(前件|后件|的后面|的前面)", e) or "⇒" in e:
        return "PD-LJ-01", 0.75
    # 多人猜测真假不定 → 真假推理
    if re.search(r"(猜测|猜对|只有一人|只有一个人).{0,20}(正确|属实|错误)", t):
        return "PD-LJ-02", 0.8
    # 排序/匹配类内容混在逻辑判断 submodule 下：内容实为分析推理，按语义打 PD-FX（见报告说明）
    if re.search(r"(甲|乙|丙|丁).{0,80}(最(大|小|高|矮|长|短|重|轻|快|慢|多|少)的是|名次|排(名|序|列))", q):
        return "PD-FX-02", 0.85
    if re.search(r"(甲|乙|丙|丁).{0,80}分别(是|来自|从事|担任|喜欢|负责)", q) or re.search(r"每人一项|值班安排.{0,40}哪项", q):
        return "PD-FX-01", 0.8
    if re.search(r"(可以推出|能够推出|由此推出|推不出|不能推出|一定为真|必定为真|必然为真|可以得出|下列.{0,4}项为真)", q):
        return "PD-LJ-03", 0.75
    if re.search(r"(日常结论题|结论题|无中生有|无法推出)", e):
        return "PD-LJ-03", 0.7
    return "UNKNOWN", 0.0


# ---------- 分析推理 PD-FX ----------
def classify_fenxi(q, e, t):
    if re.search(r"(排|名次|座位|位次|最(高|矮|重|轻|快|慢|长|短)的是|顺序)", q):
        return "PD-FX-02", 0.85
    if re.search(r"(分别(是|来自|从事|担任|喜欢)|对应|职业|匹配)", t):
        return "PD-FX-01", 0.8
    return "UNKNOWN", 0.0


GROUP_BY_SUB = {
    "图形推理": classify_tuxing,
    "定义判断": classify_dingyi,
    "类比推理": classify_leibi,
    "逻辑判断": classify_luoji,
    "逻辑推理": classify_luoji,
    "分析推理": classify_fenxi,
}

# 少量 submodule 字段直接是题型名的脏数据
DIRECT_SUB = {
    "翻译推理": ("PD-LJ-01", classify_luoji),
    "真假推理": ("PD-LJ-02", classify_luoji),
    "加强论证": ("PD-LJ-05", classify_luoji),
    "削弱论证": ("PD-LJ-06", classify_luoji),
}


def guess_submodule(r):
    """submodule 为空时，先根据内容判断属于哪个题型组。"""
    q = r.get("question") or ""
    t = text_of(r)
    if re.search(r"根据上述定义|是指|[：，:]指|上述定义|定义", t):
        return "定义判断"
    if re.search(r"对于.{1,20}相当于|之于.{1,20}相当于|逻辑关系最为相似", q):
        return "类比推理"
    if re.search(r"(见图|如图|图形|呈现一定的规律性)", q):
        return "图形推理"
    if re.search(r"[∶:].{1,12}[∶:]", q[:40]) and len(q) < 60:
        return "类比推理"
    if re.search(r"(削弱|加强|支持|质疑|前提|假设|推出|解释|真话|假话|必然为|必定为|可以得出|上述陈述为真)", q):
        return "逻辑判断"
    if re.search(r"(甲|乙|丙|丁).{0,60}(排|名次|分别|对应)", q):
        return "分析推理"
    return None


def classify(r):
    if is_math_contamination(r):
        return "UNKNOWN", 0.0, "rule"
    sub = (r.get("submodule") or "").strip() or None
    q = r.get("question") or ""
    e = r.get("explanation") or ""
    t = q + "\n" + e
    if sub in DIRECT_SUB:
        code, fn = DIRECT_SUB[sub]
        c2, conf = fn(q, e, t)
        return (c2, conf, "rule") if c2 != "UNKNOWN" else (code, 0.7, "rule")
    fn = GROUP_BY_SUB.get(sub or "")
    if fn is None:
        gsub = guess_submodule(r)
        fn = GROUP_BY_SUB.get(gsub or "")
        if fn is None:
            return "UNKNOWN", 0.0, "rule"
    code, conf = fn(q, e, t)
    return code, conf, "rule"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--untagged", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--overrides", help="人工判定覆盖文件 jsonl: {id, tag3, confidence}")
    args = ap.parse_args()

    overrides = {}
    if args.overrides:
        with open(args.overrides) as f:
            for line in f:
                line = line.strip()
                if line:
                    d = json.loads(line)
                    overrides[d["id"]] = d

    stats = Counter()
    n = 0
    with open(args.untagged) as f, open(args.out, "w") as out:
        for line in f:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            if r["id"] in overrides:
                o = overrides[r["id"]]
                rec = {"id": r["id"], "tag3": o["tag3"],
                       "confidence": o.get("confidence", 0.8), "method": "manual"}
            else:
                code, conf, method = classify(r)
                rec = {"id": r["id"], "tag3": code, "confidence": conf, "method": method}
            out.write(json.dumps(rec, ensure_ascii=False) + "\n")
            stats[rec["tag3"]] += 1
            n += 1
    print(f"total={n}")
    for k, v in stats.most_common():
        print(f"{k}\t{v}\t{v/n:.1%}")


if __name__ == "__main__":
    main()
