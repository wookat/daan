#!/usr/bin/env python3
"""TOP1 题源清洗：与现有题库题干去重 + 同源「改数字克隆题」聚类去重 + 二级题型归一。

输入: fetch_top1.py 产出的 top1_raw.jsonl
参照库: --existing 可传多个 JSONL（含 question 字段），用于题干去重
产出: knowledge/imported/top1_xingce.jsonl
  字段: module(拼音键)/submodule(二级题型名或 null)/question/options/answer/
        explanation/source/year/region

用法:
  python3 clean_top1.py --raw top1_raw.jsonl \
      --existing untagged_*.jsonl questions_bank.jsonl \
      --out knowledge/imported/top1_xingce.jsonl
"""
import argparse, json, re, collections, hashlib

MOD_KEY = {"常识判断": "changshi", "言语理解": "yanyu", "数量关系": "shuliang",
           "判断推理": "panduan", "资料分析": "ziliao"}

PUNCT_RE = re.compile(r"[\s，。、；：“”‘’\"'！？·…—()（）【】《》<>~～%％.,;:!?_\[\]-]+")
DIGIT_RE = re.compile(r"[0-9０-９一二三四五六七八九十百千万亿两]+")


def norm_text(t):
    return PUNCT_RE.sub("", t or "")


def digit_mask(t):
    return DIGIT_RE.sub("#", norm_text(t))


# ---------- SimHash 近重复（改数字克隆题聚类） ----------

def simhash(text, n=3):
    v = [0] * 64
    t = digit_mask(text)
    grams = [t[i:i + n] for i in range(max(1, len(t) - n + 1))]
    for g in grams:
        h = int.from_bytes(hashlib.md5(g.encode()).digest()[:8], "big")
        for b in range(64):
            v[b] += 1 if (h >> b) & 1 else -1
    return sum(1 << b for b in range(64) if v[b] > 0)


def hamming(a, b):
    return bin(a ^ b).count("1")


# ---------- 二级题型规则分类 ----------

RE_ANALOGY = re.compile(r"[∶:：].{1,20}[∶:：]|与.{1,8}的关系.{0,6}(在逻辑关系上)?最为(相似|接近)|依此类推|对于.{1,20}相当于")
RE_EVENT_ORDER = re.compile(r"[①-⑩（(]\s*\d?\s*[)）]?[^，。]{1,20}[②③]|事件.{0,6}顺序|排列顺序")
# 资料分析题泄漏到其他模块（PDF 分部边界错位）：缺配套材料，一律丢弃
RE_ZILIAO_LEAK = re.compile(r"同比|环比|增长率|增长量|增速|增长速度|增(长)?幅|比上年同期|零售总额|上述材料|根据材料|下列选项.{0,6}材料")
RE_ZILIAO_EXP = re.compile(r"定位.{0,4}(文字)?材料|定位(图|表)|根据资料|资料可知|根据材料|材料第[一二三四五六]段|根据(表|图)\s*\d"
                           r"|由(图|表|图表)可知|各(月|季度|年份?).{0,10}分别为|[由从]表格?数据|据(图|表)|在表格中"
                           r"|按照\d+题的方法|同上题|见上题")
# 缺材料/缺公式：引用了题干里不存在的文段/图表/公式
RE_REF_PASSAGE = re.compile(r"文中|上文|短文|该文|本文|第[一二三四五六七八]段|这段(话|文字)|作者认为")
# 引用缺失的案例/文中位置（配套材料未随题抽取）
RE_REF_CASE = re.compile(r"案例中|上述案例|该案例|根据案例|填入文中.{0,8}位置|该(报告|公文|文件)|上述(公文|报告)")
RE_LOST_FORMULA = re.compile(r"已知\s*[，,]|(那么|则)\s+的|\s的值是|[的为是占得共约]\s[，。）]|\s[＋+×÷=]\s*[，。]"
                             r"|[＝=]\s*$|[＝=]\s+[＝=，。]|(解得|可得|即得)\s*$|\s（(天|分钟|秒|米|元|棵|人|个|种|页)\s*）"
                             r"|（页\s+）|[有共]\s种|[项得可]\s[；;，。]"
                             r"|[\u4e00-\u9fff]\s[，,]|，\s+，|[为足知多满]\s+[（(＝=]"
                             r"|解得[，,。]|[\u4e00-\u9fff－\-＋+×÷]\s+[＝=]|[＝=]\s+[a-z]"
                             r"|\s（(分|种|次|圈|倍)）|[\u4e00-\u9fff]\s个[（，。]|体\s个"
                             r"|[×＋+－]\s+[＋+×－]|[：:]\s+[，。]|解得\s*、|、\s*、"
                             r"|[×÷]\s*[。；]|[＞><＜≥≤]\s+[，。）]|[\u4e00-\u9fff]\s分[）)，。]"
                             r"|[\u4e00-\u9fff]-[\u4e00-\u9fff]"
                             r"|（[a-z]\s+[a-z]）|有种(方法|方案|情况|可能|排法|选法)"
                             r"|[\u4e00-\u9fff]\s(辆|克|张|件|吨|票|筐)[，。、）]|\s（(克|辆|张|件|吨)）"
                             r"|[－\-＋+×÷]\s+）|(容量|总量)为\s"
                             r"|(至少|至多|最少|最多)有\s[\u4e00-\u9fff]")
BAD_OPTION = {"无内容", "无", "略"}
RE_STUB_EXP = re.compile(r"^(答案[:：]?\s*[A-D][。.．]?\s*)?(解析\s*)?(本题考查相关知识[，,]?\s*)?(正确答案为\s*[A-D][。.．]?\s*)?(因此[，,]?选择[A-D]选项[。.]?)?$")
CJK_RE = re.compile(r"[\u4e00-\u9fff]")
RE_ANALOGY_SHORT = re.compile(r"[∶：]\s*[\u4e00-\u9fff]|之于|对于")
NUM_OPT_RE = re.compile(r"^[0-9０-９.,，、%％/∶:：\-～~万亿千百十元米千米公里天小时分钟岁个倍种次页栋人块枚只本吨升度．\s]+$")
RE_DEFN = re.compile(r"(根据|依据|按照)(上述|以上|这个|该)定义|定义[：:，]|下列.{0,10}(属于|不属于|符合|不符合).{0,8}的(是|一项)")
RE_LOGIC = re.compile(r"(加强|削弱|支持|质疑|反驳|前提|假设)上述|如果上述(论断|断定|陈述|命题)|由此(可以推出|推不出|不能推出)"
                      r"|可以推出|据此.{0,4}(可以)?推|推理(正确|错误)|真假|说真话|说假话|必然|则以下|上述观点")

RE_LJTK = re.compile(r"依次填入|填入(画|划)?横线(部分|处)?|填入.{0,8}(空格|括号)|最恰当的一(项|组)是?$")
RE_TITLE = re.compile(r"标题")
RE_JUBIAO = re.compile(r"排列|排序|顺序|接下来|接着(最可能|讲述)|语病|歧义|病句|衔接|承接上文|填入.{0,10}最恰当的一句")
RE_DETAIL = re.compile(r"说法(正确|不正确|错误)|(不)?符合(文意|原文|这段话|文段)|(可以|能够|无法|不能)(得知|得出|推出|推断|看出|了解)"
                       r"|未涉及|不包括|没有(提到|提及|涉及)|理解(正确|不正确|有误|错误)")
RE_MAIN = re.compile(r"主旨|主要(说明|讲述|谈论|介绍|阐述|强调|讨论|论述|说的是|观点|表达|内容|意思)"
                     r"|概括|中心思想|旨在|意在(说明|强调|表明|指出|阐明)|想要?(表达|说明)|重在说明")

SHULIANG_RULES = [
    ("数字推理", re.compile(r"数列|规律.{0,6}(填入|选出)|括号(处|内|中)?.{0,6}(数字|应?填)")),
    ("行程问题", re.compile(r"相向而行|相遇|追及|背向|速度|每小时.{0,8}(千米|公里)|km/h|千米/小时|逆流|顺流|船速|水速|环形跑道")),
    ("工程问题", re.compile(r"单独(完成|做|干)|合作|工程|工作效率|效率比|注满|注水|排水管|甲队|乙队")),
    ("经济利润", re.compile(r"利润|成本|售价|进价|打(几)?折|折扣|降价|涨价|盈利|亏损|优惠|定价|营业额|销售额")),
    ("排列组合与概率", re.compile(r"概率|多少种(不同的)?(方法|方式|安排|排法|选法|组合|情况|可能)|随机|抽取|排列|组合|至少有一")),
    ("几何问题", re.compile(r"面积|体积|周长|半径|直径|正方形|长方形|三角形|圆|立方体|球|梯形|表面积|边长|棱长")),
    ("容斥原理", re.compile(r"既.{1,12}又|都(参加|喜欢|会|不)|两(项|种)都|至少参加|只参加")),
    ("浓度问题", re.compile(r"浓度|盐水|溶液|酒精|糖水|稀释|蒸发")),
    ("年龄问题", re.compile(r"岁|年龄")),
    ("周期与日期", re.compile(r"星期|周[一二三四五六日]|闰年|日期|几号|每隔")),
    ("植树与方阵", re.compile(r"植树|栽树|方阵|队列|每隔.{1,6}(米|棵)")),
    ("最值问题", re.compile(r"最多|最少|至少|至多|最大|最小|最不利")),
    ("统筹规划", re.compile(r"统筹|安排.{0,8}最(短|少|省)|最短时间|轮流|调度")),
]

CHANGSHI_RULES = [
    ("法律", re.compile(r"法律|刑法|民法|宪法|行政法|诉讼|犯罪|合同|侵权|法院|检察|违法|处罚|物权|继承|婚姻法|劳动法|治安管理")),
    ("政治", re.compile(r"马克思|毛泽东思想|邓小平|三个代表|科学发展观|新时代中国特色|中国共产党|十九大|二十大|哲学|唯物|辩证|矛盾|实践|认识论|党的|社会主义核心价值")),
    ("经济", re.compile(r"GDP|通货膨胀|货币政策|财政政策|利率|汇率|市场经济|供求|需求弹性|CPI|宏观调控|税收|国内生产总值|经济学")),
    ("管理与公文", re.compile(r"公文|行政管理|决策|函|通知|通报|请示|批复|决议|公告|发文|主送机关|管理学")),
    ("科技", re.compile(r"物理|化学|生物|光(学|线|速)|电(流|路|磁|器|压)|声(音|波|速)|(摩擦|浮|弹|重|磁)力|力学|温度|细胞|DNA|基因"
                       r"|卫星|航天|计算机|互联网|人工智能|科技|医学|疾病|维生素|能源|化合物|元素|溶液|气体|蒸发")),
    ("地理国情", re.compile(r"地理|气候|地形|河流|山脉|海洋|大气|地震|台风|季风|省份|国土|人口普查|资源分布|地球|经纬")),
    ("历史人文", re.compile(r"朝代|[唐宋明清][代朝]|汉朝|战国|春秋|历史|文学|诗人|作家|名著|书法|绘画|音乐|戏曲|传统文化|成语|典故|哲学家|思想家|文物")),
]


# 题源解析普遍以「本题考查XX」开头，该信号比题干关键词可靠
#（预编译为字符串模式，只在「考查」后的短词上匹配）
CHANGSHI_TOPIC_RULES = [
    ("法律", re.compile(r"法(律|学|规|典|治)?$|宪法|民法|刑法|诉讼|犯罪|条例|司法|侵权|合同|行政法|行政处罚|行政复议")),
    ("经济", re.compile(r"经济|货币|金融|税|财政|市场|通货|GDP|价值规律|供求")),
    ("政治", re.compile(r"时政|政治|党史|党的|党建|马克思|毛泽东|邓小平|哲学|唯物|辩证|矛盾|认识论|"
                     r"中国特色社会主义|社会主义|国情国策|政府职能|方针|政策|十[一-九]大|二十大")),
    ("管理与公文", re.compile(r"公文|管理学|行政管理|管理|行政组织|行政执行")),
    ("科技", re.compile(r"物理|化学|生物|科技|技术|计算机|信息|航天|天文|医学|医药|生活常识|能源|环保")),
    ("地理国情", re.compile(r"地理|气候|地貌|国土|资源|气象|行政区划")),
    ("历史人文", re.compile(r"历史|文学|文化|艺术|人文|书法|绘画|名画|诗|音乐|戏曲|文物|成语|习俗|节气")),
]


def changshi_sub_by_topic(explanation):
    m = re.search(r"本题考查([^。，,并]{1,20})", explanation)
    if not m:
        return None
    topic = m.group(1)
    for name, pat in CHANGSHI_TOPIC_RULES:
        if pat.search(topic):
            return name
    return None


def classify_submodule(module, q):
    text = q["question"]
    opts = "".join(q["options"].values())
    if module == "判断推理" and RE_EVENT_ORDER.search(text):
        return "分析推理"
    if module == "判断推理":
        # 类比推理要求严格的「A∶B(∶C)」短词结构，避免把知识填空题误归
        if re.match(r"^[^，。？?]{1,12}[∶:：][^，。？?]{1,12}([∶:：][^，。？?]{1,12})?$", text.strip()) \
                or (re.search(r"之于|对于", text) and len(norm_text(text)) < 40):
            return "类比推理"
        if RE_ANALOGY.search(text) and len(norm_text(text)) < 60:
            return "类比推理"
        if RE_DEFN.search(text):
            return "定义判断"
        if RE_LOGIC.search(text):
            return "逻辑判断"
        return "逻辑判断" if len(norm_text(text)) > 60 else None
    if module == "言语理解":
        if RE_TITLE.search(text):
            return "标题填入"
        # 填空题但空格标记在 PDF 转换中丢失 → 不可用，丢弃
        if (RE_LJTK.search(text) or RE_FILL_SENT.search(text)) and not RE_BLANK.search(text):
            return "DROP"
        if RE_BLANK.search(text) and RE_LJTK.search(text):
            return "逻辑填空"
        if RE_BLANK.search(text) and RE_FILL_SENT.search(text):
            return "语句表达"
        if RE_UNDERSCORE.search(text) and all(len(norm_text(o)) <= 12 for o in q["options"].values()):
            return "逻辑填空"
        if RE_JUBIAO.search(text):
            return "语句表达"
        if RE_DETAIL.search(text):
            return "细节理解"
        if RE_MAIN.search(text):
            return "中心理解"
        return None
    if module == "数量关系":
        blob = text + opts
        if not re.search(r"[0-9０-９一二三四五六七八九十百千万]", text):
            return None
        # 数量关系选项应为数值；全非数值选项说明模块标错（多为常识/言语混入）
        if not any(NUM_OPT_RE.match(o.strip()) for o in q["options"].values()):
            return None
        for name, pat in SHULIANG_RULES:
            if pat.search(blob):
                return name
        return "计算问题"
    if module == "常识判断":
        by_topic = changshi_sub_by_topic(q["explanation"])
        if by_topic:
            return by_topic
        blob = text + q["explanation"][:200]
        for name, pat in CHANGSHI_RULES:
            if pat.search(blob):
                return name
        return None
    return None


def infer_module_by_content(q):
    """仅用高置信度特征校正模块标签；无强特征时返回 None（保留原标签）。"""
    text = q["question"]
    nt = norm_text(text)
    if re.match(r"^[^，。？?]{1,12}[∶:：][^，。？?]{1,12}([∶:：][^，。？?]{1,12})?$", text.strip()) \
            or (re.search(r"之于|对于", text) and len(nt) < 40):
        return "判断推理"
    if re.search(r"(根据|依据|按照)(上述|以上|这个|该)定义", text):
        return "判断推理"
    # 加强/削弱论证题被标为常识 → 判断推理
    if q["module"] == "常识判断" and re.search(r"找出论点和论据|论点[：:]", q["explanation"][:120]):
        return "判断推理"
    # 上海卷「科学推理」（物理/化学实验题）被标为判断推理 → 常识判断
    if q["module"] == "判断推理" and re.search(r"考查(物理|化学|生物)|物理学中的", q["explanation"][:60]):
        return "常识判断"
    if re.search(r"(加强|削弱|支持|质疑|反驳)上述|论证的前提|由此可以推出|据此.{0,4}可以推|可以推出|推不出", text):
        return "判断推理"
    if re.search(r"意在(说明|强调|表明|指出)|这段(文字|话)|上述文字|这篇文章|根据文意|主旨|填入(画|划)?横线"
                 r"|重新排列.{0,8}语序|语序正确的一项|符合文意|依次填入.{0,10}词语"
        r"|语意连贯|组成.{0,8}一段文字|排序正确的一项"
                 r"|(画|划)横线(文字|部分|句子)|对(画|划)(横)?线.{0,6}理解", text):
        return "言语理解"
    # 短题干的知识型判断题被错标为言语（无文段可依据）→ 常识判断
    if q["module"] == "言语理解" and len(nt) < 60 and not RE_BLANK.search(text) \
            and not RE_JUBIAO.search(text) and re.search(r"下列|以下", text):
        return "常识判断"
    return None


RE_YICI_HINT = re.compile(r"依次填入|填入")
RE_BLANK = re.compile(r"_{2,}|＿{2,}|（\s*）|\(\s*\)")
RE_UNDERSCORE = re.compile(r"_{2,}|＿{2,}")
RE_FILL_SENT = re.compile(r"填入.{0,12}最恰当的一句")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True)
    ap.add_argument("--existing", nargs="*", default=[])
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    existing = set()
    for path in args.existing:
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if not line:
                continue
            try:
                q = json.loads(line)
            except Exception:
                continue
            t = q.get("question")
            if t:
                existing.add(norm_text(t))
    print(f"参照库题干数: {len(existing)}")

    items = [json.loads(l) for l in open(args.raw, encoding="utf-8")]
    stats = collections.Counter()


    # 0) 跨模块泄漏处置：资料分析泄漏题丢弃；纯数值选项的数学题归入数量关系
    stage0 = []
    for q in items:
        # 剥离解析尾部噪声（来源题号 / 分部标题 / 悬空「拓展」）
        q["explanation"] = re.sub(
            r"(来源\s*(第\s*\d+\s*题[、，,\s]*)+|[、，,\s]*(第\s*\d+\s*题[、，,\s]*)+|第[一二三四五六]部分\s*[\u4e00-\u9fff]{0,8}|拓展)\s*$",
            "", q["explanation"]).rstrip("　 ")
        # 剥离题源平台元数据（全站正确率/易错项）
        q["explanation"] = re.sub(
            r"[，,]?\s*全站正确率[：:]\s*\d+%[，,]?\s*(易错项[：:]\s*[A-D][，,]?)?",
            "", q["explanation"])
        # 剥离解析尾部「来源 第N题、…」题号清单（含后续考试名目）
        q["explanation"] = re.sub(
            r"来源\s*第\s*\d+\s*题[\s\S]*$", "", q["explanation"]).rstrip("　 ")
        # 剥离解析开头混入的原卷题号（如「答案：C。72、」）
        q["explanation"] = re.sub(
            r"^(答案[：:]\s*[A-D][。.]\s*)\d+\s*[、.．]\s*", r"\1", q["explanation"])
        q["explanation"] = re.sub(r"^\d+、\s*", "", q["explanation"])
        # 剥离解析开头的原卷题号（如「80.B【解析】」）
        q["explanation"] = re.sub(r"^\d+\s*[.．]\s*(?=[A-D][。.．【])", "", q["explanation"].lstrip("　 "))
        # 剥离题干尾部混入的孤立拉丁字符（PDF 页脚碎片）
        q["question"] = re.sub(r"[\s　]+[a-zA-Z]$", "", q["question"]).rstrip("　 ")
        text = q["question"]
        nt = norm_text(text)
        # PDF 提取乱码（嵌入字体 cid 占位符）
        if "(cid:" in text or "(cid:" in q["explanation"] or any("(cid:" in o for o in q["options"].values()):
            stats["mojibake_cid"] += 1
            continue
        # 解析内嵌拉丁碎片/选项字母粘连数字（OCR/PDF 损坏）
        if re.match(r"^[a-z]", q["explanation"].lstrip("　 ")) or re.search(r"[A-D]\d+项", q["explanation"]):
            stats["mojibake_cid"] += 1
            continue
        # 页码碎片混入正文（两侧都是中文的孤立短数字）
        stray_num = re.compile(r"[\u4e00-\u9fff？?，。；：、]\s\d{1,3}\s[\u4e00-\u9fff①-⑩【]|[？?]\s+\d{1,3}\s*$")
        if stray_num.search(text) or stray_num.search(q["explanation"]) \
                or any(stray_num.search(o) for o in q["options"].values()):
            stats["stray_page_number"] += 1
            continue
        # OCR 错字「昀」（应为「最」，嵌入字体识别错误）
        if "昀" in text or "昀" in q["explanation"] or any("昀" in o for o in q["options"].values()):
            stats["mojibake_cid"] += 1
            continue
        # 页码碎片「33 / 47」混入解析
        if re.search(r"\d+\s*/\s*\d+\s*[\u4e00-\u9fff]", q["explanation"]):
            stats["stray_page_number"] += 1
            continue
        # 题干内孤立数字碎片（如「几张 8 10人桌」）
        if re.search(r"[\u4e00-\u9fff]\s\d{1,3}\s\d", text):
            stats["stray_page_number"] += 1
            continue
        # 题干内孤立拉丁字母（PDF 页脚碎片，如「速度 b 令人」）
        if re.search(r"[\u4e00-\u9fff]\s+[a-zA-Z]\s+[\u4e00-\u9fff]", text):
            stats["mojibake_cid"] += 1
            continue
        # 公式图片丢失留下的空位（如「一共有： 种情况」「三角形 中」「， 千米」）
        if re.search(r"[：:为有]\s+种[情，。]|三角形\s+[中为的]|[，,]\s+千米|之和\s+。|情况数为\s", q["explanation"]):
            stats["lost_formula_exp"] += 1
            continue
        # 解析中公式图片被抹空后残留的悬空量词（如「还能喝 （瓶）」「共赛 （场）」）
        if re.search(r"[\u4e00-\u9fff]\s+（[瓶场亩米元个人天次年层组千百万公里分秒]{1,3}）",
                     q["question"] + " " + q["explanation"]):
            stats["lost_formula_exp"] += 1
            continue
        # 解析中数字被抹空后残留的悬空单位/量词（如「骑行了 小时」「行程为 公里」「增长 以上」）
        if re.search(
            r"[\u4e00-\u9fff]\s+(小时|分钟|公里|千米|米|公斤|千克|克|吨|亩|人|个|张|页|天|年|倍|次|元|种|项|家)"
            r"[，。、；;）)的后之内而就才]|增长\s+以上|低于\s+的|[：:，,]\s+[+＋×]|[（(]\s+[）)]",
                q["explanation"]):
            stats["lost_formula_exp"] += 1
            continue
        # 解析中运算符被抹空（如「=72 17-14=26」，减号/项丢失）
        if re.search(r"[=＝]\s*\d+\s+\d+\s*[-－+＋×]", q["explanation"]):
            stats["lost_formula_exp"] += 1
            continue
        # 解析中连续裸数字（公式/运算符被抹空，如「77 7 11 15 19＜0」）
        if re.search(r"\d+ \d+ \d+ \d+", q["explanation"]):
            stats["lost_formula_exp"] += 1
            continue
        # 结论式被抹空（如「故 。」「即 ，」）
        if re.search(r"[故即则共约][ 　]+[。，]", q["explanation"]):
            stats["lost_formula_exp"] += 1
            continue
        # 解析依赖未随题抽取的数据表格（资料分析题混入）
        if re.search(r"表格中的数据|与表格.{0,6}比较", q["explanation"]) \
                or re.match(r"^\(?（?\d{4}年.{0,15}该[市省县区]", text):
            stats["missing_table_exp"] += 1
            continue
        # 题干语句残缺（OCR 丢句导致的悬空比较结构）
        if re.search(r"所不能比拟的，", text):
            stats["truncated_question"] += 1
            continue
        # 选项为①②③④排序但题干未给出①②③④内容（图片实物未随题抽取）
        opt_perm = sum(1 for o in q["options"].values() if re.fullmatch(r"[①②③④⑤⑥\s]+", o.strip()))
        if opt_perm >= 3 and "①" not in text:
            stats["missing_passage"] += 1
            continue
        # 常识卷混入的言语阅读题（模块标注错误）
        if q["module"] == "常识判断" and re.search(r"这段(文字|话)|意在(说明|强调)|作者.{0,14}态度|对.{0,20}的态度[：:是]|接下来最不?可能|填入.{0,6}横线", text):
            stats["module_mismatch"] += 1
            continue
        # 言语卷混入的常识题（阅读理解题必须有文段，题干过短则为模块标注错误）
        if q["module"] == "言语理解" and len(text) < 60 \
                and "____" not in text and "（ ）" not in text \
                and not re.search(r"这段(文字|话)|文段|横线|填入|划线|画线|语病|歧义|排列|排序|衔接|连贯|标点|读音|错别字|字形|成语|词语|∶", text):
            stats["module_mismatch"] += 1
            continue
        # 解析开头被截断（以数字/右括号等碎片开头）
        if re.match(r"^([）)\]］】]|\d+\s*[）)＝=])", q["explanation"].lstrip("　 ")):
            stats["truncated_explanation"] += 1
            continue
        # 解析结尾被截断（以悬空虚词/运算符结尾）
        if re.search(r"[为是得成且到至占、，,：:；;（(＋+×＝=\-－]$", q["explanation"].rstrip("　 ")):
            stats["truncated_explanation"] += 1
            continue
        # 成套题引导语（配套材料未随题抽取）
        if re.search(r"回答\s*\d+\s*[~～\-－至—]+\s*\d+\s*题", text):
            stats["missing_passage"] += 1
            continue
        # 解析在套话开头处被截断
        if re.search(r"(逐一分析选项|辨析选项|找出定义关键词|翻译题干|进行推理|找关键信息)[。.：:]?\s*$",
                     q["explanation"].rstrip("　 ")):
            stats["truncated_explanation"] += 1
            continue
        # 题干结尾被截断
        if re.search(r"[、，,]$|[A-DＡ-Ｄ]、$", text.rstrip("　 ")):
            stats["truncated_question"] += 1
            continue
        # 选项内嵌入了大段文字（PDF 切分错位，把后续材料并入选项）
        if any(len(norm_text(o)) > 120 for o in q["options"].values()):
            stats["bad_option"] += 1
            continue
        # 选项尾部混入页码碎片
        if any(re.search(r"[\u4e00-\u9fff]\s+\d{1,3}$", o.strip()) for o in q["options"].values()):
            stats["stray_page_number"] += 1
            continue
        # 选项重复/退化（选项前缀丢失）
        if len({o.strip() for o in q["options"].values()}) < 4:
            stats["bad_option"] += 1
            continue
        # “的是：”之后还拖着碎片文字（PDF 切分错位，后文碎片并入题干）
        m_tail = re.search(r"(属于|不属于|体现|符合|不符合|正确|错误|恰当|不一致|一致)[^，。？?：:]{0,12}的(是|一项|一句)[：:](.+)$", text)
        if m_tail:
            tail = m_tail.group(3).strip()
            if len(tail) > 5 and not re.search(r"[①②③④⑤⑥⑦⑧⑨⑩]", tail) \
                    and not re.match(r"^[（(\s）)。]+$", tail):
                stats["truncated_question"] += 1
                continue
        # 题干开头即引用未随题抽取的前置陈述/材料
        if re.match(r"^\s*(\(不定项选择\))?\s*(如果|假设|若)?上述(陈述|断定|命题|条件|信息)", text):
            stats["missing_passage"] += 1
            continue
        # 题干引用未随题抽取的配套文段/公文材料（如「最后一段中……」「对上面公文标题」）
        if re.search(r"最后一段|上[面述]公文|公文标题不规范|该公文正文|上面这[篇份]", text):
            stats["missing_passage"] += 1
            continue
        # 非言语/资料模块的解析引用配套材料（材料未随题抽取）
        if q["module"] in ("常识判断", "判断推理", "数量关系") \
                and re.search(r"材料中|正文内容|上述材料", q["explanation"]):
            stats["missing_passage"] += 1
            continue
        # 选项/题干/解析中 OCR 叠字（如「的的」，伴随截断）
        if "的的" in text or "的的" in q["explanation"] or any("的的" in o for o in q["options"].values()):
            stats["bad_option"] += 1
            continue
        # 题干引用图表（图表未随题抽取）
        if re.search(r"图中|如图|如下图|[上下]图|[上下]表|如表|见图|见表|排片表|时刻表|价目表|下[列面]表格"
                     r"|下面.{0,4}幅.{0,6}(画|图)|下列图片|如下图形|(截面|示意)图|图.{0,2}所示", text):
            stats["missing_passage"] += 1
            continue
        # 题干引用的卡片/图形/表格未随题抽取（如「以上4张卡片」「以下是…得分」）
        if re.search(r"以上\s*[\d一-十]+\s*(张卡片|个图形|幅图)|以下是[^，。]{0,20}(情况|得分|数据)", text):
            stats["missing_passage"] += 1
            continue
        # 解析依赖未随题抽取的图/表（如「如图所示」「通过表格可知」）
        if re.search(r"如图|见下图|(通过|观察|由)表格", q["explanation"]):
            stats["missing_table_exp"] += 1
            continue
        # 题源自认争议题（答案不唯一）
        if "争议题" in q["explanation"]:
            stats["disputed"] += 1
            continue
        # 题干内嵌入试卷名页眉（PDF 页眉混入正文）
        if re.search(r"[\u4e00-\u9fff]\s*\d{4}(年)?[\u4e00-鿿]{0,10}(公务员|选调生)[\u4e00-鿿]{0,8}《行测》?", text):
            stats["stray_page_number"] += 1
            continue
        # 选项中公式图片丢失（如「6（ -1）」）
        if any(re.search(r"[（(]\s+[-－+＋]?\d", o) for o in q["options"].values()):
            stats["lost_formula"] += 1
            continue
        # 长选项尾部截断（以悬空动词/介词结尾）
        if any(len(norm_text(o)) >= 20 and re.search(r"[出将对由向把被]$|法律责$|享有$", o.strip()) for o in q["options"].values()):
            stats["bad_option"] += 1
            continue
        # 题干丢失数字（如“得3票…得票的作品”）
        if re.search(r"得\d+票", text) and re.search(r"[^\d０-９]得票的", text):
            stats["lost_formula"] += 1
            continue
        # 解析中数字丢失后留下的空白单位（如“通过计算 元”）
        if re.search(r"[\u4e00-\u9fff]\s(元|吨|票|筐|千克)([，。、）]|\s*$)", q["explanation"]):
            stats["lost_formula_exp"] += 1
            continue
        if q["module"] != "数量关系" and RE_ZILIAO_LEAK.search(text):
            stats["ziliao_leak"] += 1
            continue
        # 解析里引用了资料分析材料 → 资料分析漏题
        if RE_ZILIAO_EXP.search(q["explanation"]):
            stats["ziliao_leak_exp"] += 1
            continue
        # 解析与题干内容几乎零重叠 → PDF 转换解析错位（仅字面答案字母碰巧对齐）
        ent = norm_text(q["explanation"])
        qo = nt + norm_text("".join(q["options"].values()))
        if len(qo) >= 20 and len(ent) >= 20:
            qgrams = {qo[i:i + 2] for i in range(len(qo) - 1)}
            egrams = {ent[i:i + 2] for i in range(len(ent) - 1)}
            if qgrams and len(qgrams & egrams) / len(qgrams) < 0.10:
                stats["explanation_semantic_mismatch"] += 1
                continue
        # 选项截断（以顿号/逗号/悬空连词或动词结尾的碎片选项）
        if any(re.search(r"[、，,与和及]$|(得到了|受到了|责怪|以及|并且|而且|或者|但是|因为|由于|使得|对其|将其)[\u4e00-\u9fff]{0,2}$",
                     o.strip()) for o in q["options"].values()):
            stats["bad_option"] += 1
            continue
        # 引用文段但题干过短（文段未随题抽取）
        if RE_REF_PASSAGE.search(text) and len(nt) < 50:
            stats["missing_passage"] += 1
            continue
        # 解析定位到原文段落但题干里没有对应文段（篇章阅读缺材料）
        if re.search(r"定位原文|第[一二三四五六七八九十]+段", q["explanation"]) and len(nt) < 200:
            stats["missing_passage"] += 1
            continue
        # 题干引用图表但图表未随题抽取
        if re.search(r"如(下|上)?(图|表)(\d|所示)|见(下|上)?(图|表)|(下|上)表|(下|上)图", text) \
                or re.search(r"如图\s*\d|如(下|上)图|列表如下[^：:，。]|由?(下|上)表", q["explanation"]):
            stats["missing_passage"] += 1
            continue
        # 逻辑填空空位标记丢失（选项均为空格分隔的短词组而题干无空位标记）
        opt_wordlist = re.compile(r"^[\u4e00-\u9fff]{1,6}(\s+[\u4e00-\u9fff]{1,6}){1,4}$")
        if all(opt_wordlist.match(o.strip()) for o in q["options"].values()) \
                and not RE_BLANK.search(text) and not RE_UNDERSCORE.search(text):
            stats["fill_blank_marker_lost"] += 1
            continue
        # 数量关系解析使用了未定义的变量（解析开头被截断，设元语句丢失）
        if q["module"] == "数量关系" and re.search(r"[a-z]\s*[＝=]|[＝=]\s*[a-z]", q["explanation"]) \
                and "设" not in q["explanation"] and "代入" not in q["explanation"]:
            stats["truncated_explanation"] += 1
            continue
        if RE_REF_CASE.search(text):
            stats["missing_passage"] += 1
            continue
        # 公式在 PDF 转换中丢失
        if RE_LOST_FORMULA.search(text):
            stats["lost_formula"] += 1
            continue
        if any(o.strip() in BAD_OPTION for o in q["options"].values()):
            stats["bad_option"] += 1
            continue
        # 选项全为 5 位以上纯数字（Excel 日期序列号等转换损坏）
        if all(re.fullmatch(r"\d{5,}", o.strip()) for o in q["options"].values()):
            stats["bad_option"] += 1
            continue
        # 解析引用了题干里不存在的条件列表（条件未随题抽取）
        if re.search(r"(根据|结合|由)条件[（(]\d|分析题干\s*[（(]1[)）]", q["explanation"]) and not re.search(r"[（(]\s*1\s*[)）]|①", text):
            stats["missing_conditions"] += 1
            continue
        # 题干引用题组共享材料（“该场比赛”等未随题抽取）
        if re.search(r"该场(比赛|游戏|考试)|上述比赛", text):
            stats["missing_passage"] += 1
            continue
        # 解析中“列表/表格如下”但表格丢失
        if re.search(r"(列表|表格|列出表)如下[：:]\s*第[一二三四五]步", q["explanation"]):
            stats["missing_table_exp"] += 1
            continue
        # 解析结尾拖着孤立数字碎片（OCR 残留）
        if re.search(r"[。？?！!）)]\s*(\d\s+)+\d\s*$", q["explanation"]):
            stats["stray_page_number"] += 1
            continue
        # 数字丢失的空白占位（如「为 万吨」「购买 台」「需要 （小时）」）
        if re.search(
            r"为\s+万?[吨元][，。、；]|购买\s+台|[\u4e00-\u9fff]\s+（(小时|分钟|天|元|吨|米|人|台|个)）",
            q["explanation"],
        ):
            stats["lost_formula_exp"] += 1
            continue
        # 解析内部截断（残留「合定义/合语境」等断句碎片）
        if re.search(r"[。；;]\s*合(定义|语境|文意)", q["explanation"]):
            stats["truncated_explanation"] += 1
            continue
        # 答案与解析矛盾（对正确答案项的辨析以「排除」收尾）
        m_seg = re.search(
            rf"{q['answer']}项[：:](.*?)(?=[A-D]项[：:]|因此|故正确答案|故选)",
            q["explanation"], re.S)
        if m_seg:
            seg = m_seg.group(1).strip()
            if re.search(r"排除[。；;]?\s*$", seg) and not re.search(r"当选|符合|(?<!不)一致[，。]", seg):
                stats["answer_exp_conflict"] += 1
                continue
        # 解析中明确「排除」了正确答案项（题源文字错误）
        if re.search(
            rf"排除\s*(?:[A-D]\s*项?\s*(?:和|、|，|,)\s*)*{q['answer']}\s*项",
            q["explanation"],
        ):
            stats["answer_exp_conflict"] += 1
            continue
        if RE_STUB_EXP.match(q["explanation"]) or len(norm_text(q["explanation"])) < 25:
            stats["stub_explanation"] += 1
            continue
        if RE_LOST_FORMULA.search(q["explanation"]):
            stats["lost_formula_exp"] += 1
            continue
        is_analogy_like = bool(RE_ANALOGY_SHORT.search(text.rstrip("：:∶ "))) and len(nt) < 40
        # 题干过短或几乎无中文（符号乱码/缺上下文），类比题除外
        if not is_analogy_like:
            if len(nt) < 12:
                stats["too_short"] += 1
                continue
            if len(CJK_RE.findall(nt)) < 0.4 * len(nt):
                stats["low_cjk_ratio"] += 1
                continue
        # 引用具体年份问数据但题干几乎无给定数据 → 资料分析漏题
        if re.search(r"(19|20)\d{2}年", text) and re.search(r"多少|约为?|最[高低大小多少]|增[长加]|比重|比例|下降|超过|改进|明显", text):
            nums = re.findall(r"\d+(?:\.\d+)?", re.sub(r"(19|20)\d{2}年?", "", text))
            if len(nums) < 2:
                stats["ziliao_leak_yearq"] += 1
                continue
        if q["module"] in ("常识判断", "言语理解") and \
                all(NUM_OPT_RE.match(o) for o in q["options"].values()) and \
                re.search(r"\d", q["question"]) and re.search(r"多少|几(天|岁|个|种|次|千米|米)|速度|时速", q["question"]):
            stats["math_leak_reassigned"] += 1
            q = dict(q, module="数量关系")
        if q["module"] in ("常识判断", "言语理解") and re.search(
                r"本题考查(数列问题|基础应用题|行程问题|经济利润问题|排列组合问题|几何问题|工程问题|容斥问题|多位数问题|最值问题)",
                q["explanation"]):
            stats["math_leak_reassigned"] += 1
            q = dict(q, module="数量关系")
        if q["module"] == "言语理解" and RE_EVENT_ORDER.search(text) and len(nt) < 80:
            stats["event_order_reassigned"] += 1
            q = dict(q, module="判断推理")
        # 内容强特征校正模块（源 PDF 分部边界错位导致的跨模块错标）
        content_mod = infer_module_by_content(q)
        if content_mod and content_mod != q["module"]:
            stats["module_reassigned_by_content"] += 1
            q = dict(q, module=content_mod)
        stage0.append(q)

    # 1) 与现有题库去重 + 源内精确去重
    seen = set()
    stage1 = []
    for q in stage0:
        key = norm_text(q["question"])
        if key in existing:
            stats["dup_vs_existing"] += 1
            continue
        if key in seen:
            stats["dup_exact_in_source"] += 1
            continue
        seen.add(key)
        stage1.append(q)

    # 2) 改数字克隆题：数字掩码精确 + SimHash 近重复聚类（同模块内），每簇保留一道
    by_mask = {}
    stage2 = []
    for q in stage1:
        mk = (q["module"], digit_mask(q["question"]))
        if mk in by_mask:
            stats["clone_digit_mask"] += 1
            continue
        by_mask[mk] = True
        stage2.append(q)

    final = []
    # SimHash 4-band 分桶，桶内 hamming<=3 视为克隆
    buckets = collections.defaultdict(list)  # (module, band_idx, band_val) -> [(sh, idx)]
    kept_sh = []
    for q in stage2:
        sh = simhash(q["question"])
        is_clone = False
        cand = set()
        for bi in range(4):
            band = (sh >> (bi * 16)) & 0xFFFF
            cand.update(buckets[(q["module"], bi, band)])
        for j in cand:
            if hamming(sh, kept_sh[j]) <= 3:
                is_clone = True
                break
        if is_clone:
            stats["clone_simhash"] += 1
            continue
        idx = len(kept_sh)
        kept_sh.append(sh)
        for bi in range(4):
            band = (sh >> (bi * 16)) & 0xFFFF
            buckets[(q["module"], bi, band)].append(idx)
        final.append(q)

    # 3) 模块/二级题型归一
    sub_stats = collections.Counter()
    out = []
    for q in final:
        sub = classify_submodule(q["module"], q)
        if sub == "DROP":
            stats["fill_blank_marker_lost"] += 1
            continue
        if sub is None:
            # 宁精勿滥：无法可靠归入二级题型的丢弃
            stats["unclassified_submodule"] += 1
            continue
        sub_stats[(q["module"], sub)] += 1
        out.append({
            "module": MOD_KEY[q["module"]],
            "submodule": sub,
            "question": q["question"],
            "options": q["options"],
            "answer": q["answer"],
            "explanation": q["explanation"],
            "source": q["source"],
            "year": q["year"],
            "region": q["region"],
        })

    with open(args.out, "w", encoding="utf-8") as w:
        for q in out:
            w.write(json.dumps(q, ensure_ascii=False) + "\n")

    print(json.dumps({"raw_in": len(items), "after_dedup_existing": len(stage1),
                      "after_digit_mask": len(stage2), "final": len(out),
                      "drops": dict(stats)}, ensure_ascii=False, indent=2))
    mod_c = collections.Counter(q["module"] for q in out)
    print("模块分布:", json.dumps(dict(mod_c), ensure_ascii=False))
    print("二级分布:")
    for (m, s), c in sorted(sub_stats.items()):
        print(f"  {m} / {s}: {c}")


if __name__ == "__main__":
    main()
