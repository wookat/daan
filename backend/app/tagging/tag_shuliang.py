#!/usr/bin/env python3
"""数量关系（shuliang）三级考点规则打标脚本。

两阶段：
1) 定组（二级题型 group）：优先用 submodule 别名映射；submodule 缺失时用题干+解析关键词判组。
2) 组内定考点（三级 topic）：按各组的特征词规则判定，命中强特征给高置信度。

用法：python3 tag_shuliang.py <untagged.jsonl> <taxonomy.json> <out.jsonl>
"""
import json
import re
import sys
from collections import Counter


def load_taxonomy(path):
    with open(path, encoding="utf-8") as f:
        t = json.load(f)
    for m in t["modules"]:
        if m["key"] == "shuliang":
            return m
    raise SystemExit("shuliang module not found in taxonomy")


# submodule → group code（含数据中的长尾取值归并）
SUBMODULE_GROUP = {
    "计算问题": "SL-JS", "和倍问题": "SL-JS", "还原问题": "SL-JS",
    "平均数问题": "SL-JS", "不定方程": "SL-JS", "盈亏问题": "SL-JS",
    "余数问题": "SL-JS", "鸡兔同笼": "SL-JS", "加权平均": "SL-JS",
    "分数变化": "SL-JS", "约数个数": "SL-JS", "末尾零个数": "SL-JS",
    "数学运算": None,  # 混杂，走关键词判组
    "其他应用题": None,
    "行程问题": "SL-XC", "车轮转数": "SL-XC", "进退问题": "SL-XC",
    "工程问题": "SL-GC", "牛吃草问题": "SL-GC", "注排水问题": "SL-GC",
    "经济利润": "SL-JJ", "增长率": "SL-JJ",
    "排列组合与概率": "SL-PL", "分组计数": "SL-PL", "比赛场次": "SL-PL",
    "递推计数": "SL-PL", "编号计数": "SL-PL", "队列问题": "SL-PL",
    "几何问题": "SL-JH",
    "最值问题": "SL-ZZ", "最不利原则": "SL-ZZ", "抽屉原理": "SL-ZZ",
    "构造类问题": "SL-ZZ", "比赛积分": "SL-ZZ",
    "容斥原理": "SL-RC", "容斥问题": "SL-RC",
    "周期与日期": "SL-ZQ", "钟表问题": "SL-ZQ", "周期推算": "SL-ZQ",
    "敲钟问题": "SL-ZQ",
    "统筹规划": "SL-TC", "统筹优化": "SL-TC", "博弈策略": "SL-TC",
    "浓度问题": "SL-ND", "浓度交换": "SL-ND", "混合比例": "SL-ND",
    "年龄问题": "SL-NL",
    "数列问题": "SL-SZ", "数字推理": "SL-SZ", "数字推理-多重数列": "SL-SZ",
    "植树问题": "SL-QT", "方阵问题": "SL-QT", "爬楼问题": "SL-QT",
    "锯木问题": "SL-QT", "对折剪绳": "SL-QT",
}


def has(text, *kws):
    return any(k in text for k in kws)


def re_has(text, pattern):
    return re.search(pattern, text) is not None


def detect_group(text):
    """submodule 缺失时的判组规则（按特征强弱排序）。"""
    exp = text
    # 解析中明确“本题考查XX”优先
    m = re.search(r"考查([^，。;；,\s]{1,20})", exp)
    if m:
        kw = m.group(1)
        for pat, g in [
            ("行程", "SL-XC"), ("工程", "SL-GC"), ("牛吃草", "SL-GC"),
            ("经济利润", "SL-JJ"), ("排列组合", "SL-PL"), ("概率", "SL-PL"),
            ("几何", "SL-JH"), ("最值", "SL-ZZ"), ("容斥", "SL-RC"),
            ("钟表", "SL-ZQ"), ("星期", "SL-ZQ"), ("日期", "SL-ZQ"),
            ("周期", "SL-ZQ"), ("统筹", "SL-TC"), ("溶液", "SL-ND"),
            ("浓度", "SL-ND"), ("年龄", "SL-NL"), ("数列", "SL-SZ"),
            ("植树", "SL-QT"), ("方阵", "SL-QT"), ("平均数", "SL-JS"),
            ("不定方程", "SL-JS"), ("余数", "SL-JS"), ("约数倍数", "SL-JS"),
            ("多位数", "SL-JS"), ("盈亏", "SL-JS"),
        ]:
            if pat in kw:
                return g
    if has(exp, "牛吃草"):
        return "SL-GC"
    if has(exp, "排队") and has(exp, "窗口") and has(exp, "匀速增加", "不断有人", "队伍消失"):
        return "SL-GC"  # 排队售票=牛吃草模型
    if re_has(exp, "两[样证项种门]都") or has(exp, "二集合", "三集合", "容斥"):
        return "SL-RC"
    if re_has(exp, "若每[^。]{0,10}(剩|多|余)[^。]{0,20}若每[^。]{0,10}(差|少|不足|缺)") or \
            re_has(exp, "若每[^。]{0,10}(差|少|不足|缺)[^。]{0,20}若每[^。]{0,10}(剩|多|余)"):
        return "SL-JS"  # 盈亏模板
    if re_has(exp, "第\\s?1\\s?年[^。]{0,25}每年(增加|递增|增长|减少)") or has(exp, "连续整数", "连续自然数", "连续奇数", "连续偶数"):
        return "SL-SZ"
    if re_has(exp, "每[按加提][^。]{0,12}(倍|%)") and has(exp, "次后"):
        return "SL-SZ"
    if has(exp, "长") and has(exp, "宽") and has(exp, "高") and has(exp, "容积", "立方米", "体积"):
        return "SL-JH"
    if has(exp, "时针", "分针", "钟面", "表盘"):
        return "SL-ZQ"
    if has(exp, "星期一", "星期二", "星期三", "星期四", "星期五", "星期六",
           "星期日", "星期天", "闰年", "平年") or re_has(exp, "星期[几]"):
        return "SL-ZQ"
    if has(exp, "浓度", "溶液", "溶质", "盐水", "糖水", "酒精"):
        return "SL-ND"
    if has(exp, "顺流", "逆流", "顺水", "逆水", "静水", "水速", "船速"):
        return "SL-XC"
    if has(exp, "相遇", "追及", "追上") and has(exp, "速度", "出发", "路程", "km/h", "千米/小时"):
        return "SL-XC"
    if has(exp, "利润", "售价", "进价", "成本价", "打折", "折扣", "定价", "亏本", "盈利", "纳税", "计税"):
        return "SL-JJ"
    if has(exp, "工作效率", "工作总量", "工程总量", "单独完成", "合作完成", "工程队", "注水", "排水", "进水管", "出水管") or \
            re_has(exp, "(单独|合[作干])[^。]{0,12}(完成|做完|需要?\\d)") or \
            re_has(exp, "(生产线|流水线)[^。]{0,12}效率") or re_has(exp, "效率(是|之比|提升为|提高为)"):
        return "SL-GC"
    if has(exp, "概率", "排列", "组合", "多少种", "几种不同", "种不同的") and not has(exp, "数列"):
        return "SL-PL"
    if has(exp, "最不利", "才能保证", "抽屉原理") or \
            re_has(exp, "至少要?(备|安排|派|买|准备|配|订|购|请|租|带|运|推|进|用)"):
        return "SL-ZZ"
    if has(exp, "容斥"):
        return "SL-RC"
    if has(exp, "面积", "周长", "体积", "表面积", "半径", "直径", "正方形", "长方形",
           "三角形", "圆柱", "圆锥", "正方体", "长方体", "勾股", "相似三角形"):
        return "SL-JH"
    if has(exp, "平均年龄"):
        return "SL-JS"
    if has(exp, "年龄", "岁"):
        return "SL-NL"
    if has(exp, "植树", "栽树", "两端", "每隔") and has(exp, "棵", "株", "盏", "根"):
        return "SL-QT"
    if has(exp, "方阵", "最外层"):
        return "SL-QT"
    if has(exp, "空瓶", "烙饼", "过桥") and has(exp, "换", "最少", "最短"):
        return "SL-TC"
    if has(exp, "速度", "路程") and has(exp, "小时", "分钟") and has(exp, "千米", "公里", "米"):
        return "SL-XC"
    if has(exp, "平均"):
        return "SL-JS"
    if has(exp, "余数", "整除", "倍数", "约数", "质数", "不定方程", "盈亏", "多退少补",
           "和差倍", "鸡兔同笼", "方程"):
        return "SL-JS"
    # 纯算式解析（模板题：收支合计/工时合计/按比例配制等）→ 基础计算
    exp_only = exp.split("\n", 1)[-1] if "\n" in exp else exp
    m2 = re.search(r"[\d\.]+\s*[+\-*/×÷]\s*[\d\.]+", exp_only)
    if m2 and (has(exp, "共收入", "共支出", "共到账", "共需多少", "共多少", "合计")
               or re_has(exp, "按[^。]{0,15}%\\s?配制")):
        return "SL-JS"
    return None


# ---------------- 组内三级考点规则 ----------------

def topic_js(q, e, sub, t):
    if sub == "不定方程" or has(t, "不定方程"):
        return "SL-JS-04", 0.9
    if sub == "盈亏问题" or has(t, "盈亏", "多退少补"):
        return "SL-JS-07", 0.9
    if sub == "还原问题" or has(t, "还原问题", "逆推", "倒推"):
        return "SL-JS-08", 0.9
    if sub in ("平均数问题", "加权平均") or has(t, "平均数", "平均分", "平均成绩", "平均年龄",
                                          "加权平均", "移多补少") or re_has(t, "平均每"):
        return "SL-JS-09", 0.85
    if sub == "余数问题" or has(t, "余数", "同余", "剩余定理") or re_has(t, "除以\\s?\\d+\\s?余"):
        return "SL-JS-05", 0.9
    if sub == "和倍问题" or has(t, "和差倍", "鸡兔同笼") or sub == "鸡兔同笼":
        return "SL-JS-06", 0.85
    if has(t, "整除特性", "能被整除", "整除判定", "约数", "公倍数", "公约数", "倍数特性") or \
            re_has(t, "能?被\\s?\\d+\\s?整除"):
        return "SL-JS-02", 0.85
    if has(t, "按比例", "比例分配", "连比") or \
            (re_has(t, "\\d+\\s*[:：∶]\\s*\\d+") and has(t, "分给", "分配", "比例")):
        return "SL-JS-03", 0.7
    if re_has(t, "是[^。，]{0,6}的\\s?\\d+(\\.\\d+)?\\s?倍") and has(t, "和为", "之和", "共有", "相差", "之差"):
        return "SL-JS-06", 0.7
    return "SL-JS-01", 0.6


def topic_xc(q, e, sub, t):
    if has(t, "顺流", "逆流", "顺水", "逆水", "静水", "水速", "船速", "漂流"):
        return "SL-XC-04", 0.9
    if has(t, "火车", "车长", "列车") and has(t, "过桥", "隧道", "桥长", "完全通过", "车身"):
        return "SL-XC-05", 0.9
    if (has(t, "相遇") and re_has(t, "第[二三四五2345]次|多次相遇|往返")) or has(t, "第二次相遇", "第三次相遇"):
        return "SL-XC-03", 0.85
    if has(t, "休息", "间歇", "变速", "提速后", "降速", "减速后") and has(t, "速度", "行驶", "行走"):
        return "SL-XC-06", 0.75
    if has(t, "相遇", "相向而行", "追及", "追上", "同向而行", "背向而行", "环形跑道"):
        return "SL-XC-02", 0.85
    # 基础行程要求题面含真实行程要素（速度/里程），排除被误标为行程的清单类题
    if has(t, "速度", "时速", "km/h", "米/秒", "米/分") or \
            re_has(t, "[车行骑步航]行?\\s?\\d+(\\.\\d+)?\\s?(千米|公里|海里|米)"):
        return "SL-XC-01", 0.6
    return None, 0


def topic_gc(q, e, sub, t):
    if sub == "牛吃草问题" or has(t, "牛吃草", "草场", "牧场的草", "匀速生长"):
        return "SL-GC-04", 0.9
    if has(t, "交替", "轮流", "轮换") or re_has(t, "甲[、乙丙]+[^。]{0,10}(依次|循环)"):
        return "SL-GC-03", 0.9
    if has(t, "效率比", "效率之比", "效率相当于") or re_has(t, "效率是[^。，]{0,8}的?\\s?\\d+(\\.\\d+)?\\s?倍"):
        return "SL-GC-02", 0.85
    return "SL-GC-01", 0.6


def topic_jj(q, e, sub, t):
    if has(t, "阶梯", "分段计费", "超过部分", "超出部分", "起步价", "个人所得税", "起征点", "累进", "应纳税额", "计税方式"):
        return "SL-JJ-02", 0.9
    if has(t, "哪种方案", "最划算", "更划算", "最优惠", "方案最", "最省钱", "何种方式", "最合算") or \
            (has(t, "方案") and has(t, "最少", "最多", "最低", "最高")):
        return "SL-JJ-03", 0.8
    return "SL-JJ-01", 0.6


def topic_pl(q, e, sub, t):
    prob = has(t, "概率", "可能性为", "可能性是")
    if prob:
        if has(t, "至少一次", "恰好一次", "每次命中", "命中率", "独立", "连续两次",
               "已知其", "在……条件下", "条件概率") or re_has(t, "第[一二三]次[^。]{0,12}第[一二三]次"):
            return "SL-PL-07", 0.8
        return "SL-PL-06", 0.8
    if has(t, "相邻", "不相邻", "捆绑", "插空", "不能挨", "挨着"):
        return "SL-PL-02", 0.9
    if has(t, "错位", "都不在原来", "都不对应", "均不一致", "装错"):
        return "SL-PL-03", 0.9
    if has(t, "圆桌", "围成一圈", "围成一个圆", "环形排列", "首尾相接"):
        return "SL-PL-04", 0.85
    if has(t, "平均分成", "分成若干组", "分组", "分配到", "分到", "分给") and has(t, "种"):
        return "SL-PL-05", 0.75
    return "SL-PL-01", 0.6


def topic_jh(q, e, sub, t):
    if has(t, "最短路径", "最短距离", "路径最短", "展开图", "表面爬", "面积最大", "面积最小",
           "周长最短", "体积最大", "用料最省"):
        return "SL-JH-04", 0.85
    if has(t, "体积", "容积", "表面积", "立方米", "正方体", "长方体", "圆柱", "圆锥", "球体", "棱长", "棱柱", "切割", "堆成"):
        return "SL-JH-02", 0.85
    if has(t, "相似三角形", "相似比", "勾股", "直角三角形的斜边", "内角和", "外角", "对顶角", "全等"):
        return "SL-JH-03", 0.8
    return "SL-JH-01", 0.6


def topic_zz(q, e, sub, t):
    if sub in ("最不利原则", "抽屉原理") or has(t, "最不利", "才能保证", "抽屉原理", "至少……保证"):
        return "SL-ZZ-01", 0.9
    if has(t, "名次", "排名", "得分互不相同", "分数互不相同", "各不相同") and has(t, "最多", "最少", "至少", "至多"):
        return "SL-ZZ-02", 0.8
    if re_has(t, "至少要?(备|买|准备|安排|派|配|订|购|请|租|带|运|推|进|用)") or \
            re_has(t, "至少[^。]{0,15}(才够|才能满足|才能完成|才能装完|才能保障)") or \
            (has(t, "每") and re_has(t, "至少(需要|要)?[^。]{0,12}(多少|几)")):
        return "SL-ZZ-01", 0.6  # 保证够用类，归入最不利构造（弱）
    if has(t, "每") and re_has(t, "最多(能|还能|可以)[^。]{0,10}(多少|几)"):
        return "SL-ZZ-01", 0.6
    if has(t, "乘积最大", "乘积最小", "最小公倍数最大") and has(t, "和为", "之和为", "拆成"):
        return "SL-ZZ-02", 0.7
    if has(t, "反向构造", "都参加", "同时满足") and has(t, "至少"):
        return "SL-ZZ-03", 0.75
    if re_has(t, "第\\s?[一二三四五1-5]\\s?名") and has(t, "最多", "最少"):
        return "SL-ZZ-02", 0.75
    return None, 0


def topic_rc(q, e, sub, t):
    # 明显非容斥内容（submodule 被误标）：解析明确考查其他考点，或题面是整除/数列语境
    m = re.search(r"考查([^，。;；,\s]{1,20})", e)
    if m and "容斥" not in m.group(1) and "集合" not in m.group(1):
        return None, 0
    if has(t, "整除", "数列", "公倍数", "倍数") and not has(t, "容斥"):
        return None, 0
    if has(e, "二集合") or re_has(t, "两[样证项种门个处类]都") or has(t, "双证", "双认证"):
        if not has(t, "三"):
            return "SL-RC-01", 0.9
    if has(e, "三集合") or re_has(t, "三[样证项种门个]"):
        if has(t, "恰好", "只属于", "只参加一", "仅参加", "只喜欢", "只会一", "仅有一"):
            return "SL-RC-03", 0.8
        return "SL-RC-02", 0.8
    if has(t, "恰好", "只属于", "只参加一", "仅参加", "只喜欢") and has(t, "三"):
        return "SL-RC-03", 0.75
    if t.count("、") >= 2 and has(t, "既", "又", "都") and has(t, "三"):
        return "SL-RC-02", 0.65
    if has(t, "既", "又") or re_has(t, "两[个种门项]"):
        return "SL-RC-01", 0.7
    return None, 0


CLOCK_KWS = ("时针", "分针", "秒针", "钟面", "表盘", "快钟", "慢钟", "挂钟",
             "比标准时间", "对准", "敲钟", "镜子里看到时钟")


def topic_zq(q, e, sub, t):
    # 解析明确考查其他考点（submodule 被误标）
    m = re.search(r"考查([^，。;；,\s]{1,20})", e)
    if m and not has(m.group(1), "周期", "日期", "星期", "钟表", "循环"):
        return None, 0
    if has(t, *CLOCK_KWS) or (has(t, "钟表") and has(t, "点", "分")):
        return "SL-ZQ-03", 0.9
    if sub == "钟表问题":
        return None, 0  # submodule 为钟表但题面无钟表要素，多为误标数据
    if has(t, "星期", "周一", "周二", "周三", "周四", "周五", "周六", "周日", "闰年", "平年", "礼拜"):
        return "SL-ZQ-02", 0.9
    if has(t, "年龄") and has(t, "岁"):
        return None, 0  # 年龄题被误标为周期日期
    if has(t, "约数") or (has(q, "倍数", "整数倍") and not re_has(q, "每[\\d一二三四五六七八九十]") and not has(q, "周期", "循环", "每隔")):
        return None, 0  # 约数倍数题被误标为周期日期
    # 日期推算（跨月天数/到期日）归星期日期
    if re_has(q, "\\d+月\\d+日") and has(q, "多少天", "几日", "哪天", "到期", "哪年"):
        return "SL-ZQ-02", 0.8
    return "SL-ZQ-01", 0.6


def topic_tc(q, e, sub, t):
    if has(t, "空瓶", "瓶盖", "兑换", "换一瓶", "换酒"):
        return "SL-TC-03", 0.9
    if has(t, "烙饼", "过桥", "排队打水", "轮流使用", "最短时间", "至少需要多少时间",
           "最少需要多少分钟", "最快", "时间最少"):
        return "SL-TC-01", 0.8
    return "SL-TC-02", 0.6


def topic_nd(q, e, sub, t):
    if has(t, "混合", "倒入", "兑在一起", "配成", "混在"):
        return "SL-ND-02", 0.85
    if has(t, "蒸发", "加水", "稀释", "加入水", "倒掉"):
        return "SL-ND-01", 0.85
    return "SL-ND-02", 0.5


def topic_nl(q, e, sub, t):
    if not has(q, "岁", "年龄"):
        return None, 0  # submodule 为年龄但题面无年龄要素，多为误标数据
    if re_has(t, "年龄[^。]{0,6}是[^。]{0,8}倍") or re_has(t, "是[^。，]{0,8}年龄的") or has(t, "倍"):
        return "SL-NL-02", 0.75
    return "SL-NL-01", 0.6


def parse_seq(q):
    """从数字推理题干提取数列（含括号占位）。"""
    body = q.replace("（", "(").replace("）", ")")
    if "(" not in body:
        return None
    nums = re.findall(r"-?\d+(?:\.\d+)?(?:/\d+)?", body.split("(")[0])
    if len(nums) < 4:
        return None
    try:
        vals = []
        for x in nums:
            if "/" in x:
                a, b = x.split("/")
                vals.append(float(a) / float(b))
            else:
                vals.append(float(x))
        return vals
    except (ValueError, ZeroDivisionError):
        return None


def seq_kind(v):
    """数字推理数列的数值规律启发式判断。"""
    n = len(v)
    d = [v[i + 1] - v[i] for i in range(n - 1)]
    if len(set(d)) == 1:
        return "SL-SZ-01", 0.9
    d2 = [d[i + 1] - d[i] for i in range(len(d) - 1)]
    if len(d2) >= 2 and len(set(d2)) == 1:
        return "SL-SZ-01", 0.85  # 二级等差
    if all(x != 0 for x in v[:-1]):
        r = [v[i + 1] / v[i] for i in range(n - 1)]
        if all(abs(x - r[0]) < 1e-9 for x in r):
            return "SL-SZ-02", 0.9
        if len(r) >= 3:
            r2 = [r[i + 1] / r[i] for i in range(len(r) - 1) if r[i] != 0]
            if r2 and all(abs(x - r2[0]) < 1e-9 for x in r2):
                return "SL-SZ-02", 0.8
    if n >= 4 and all(abs(v[i] + v[i + 1] - v[i + 2]) < 1e-9 for i in range(n - 2)):
        return "SL-SZ-03", 0.9
    if n >= 4 and all(v[i] * v[i + 1] == v[i + 2] for i in range(n - 2)):
        return "SL-SZ-03", 0.9
    for k, b in ((2, 0), (2, 1), (2, -1), (3, 0), (3, 1), (3, -1)):
        if all(abs(round((x - b) ** (1.0 / k)) ** k - (x - b)) < 1e-6 for x in v if x - b >= 0) and \
                all(x - b >= 0 for x in v):
            return "SL-SZ-04", 0.8
    if n >= 6:
        odd, even = v[0::2], v[1::2]
        def is_reg(s):
            if len(s) < 3:
                return False
            ds = [s[i + 1] - s[i] for i in range(len(s) - 1)]
            return len(set(ds)) == 1
        if is_reg(odd) and is_reg(even):
            return "SL-SZ-05", 0.8  # 交叉数列
    return None, 0


def topic_sz(q, e, sub, t):
    # 等差应用题（每天/周/月/年 定额递增或递减，求第 n 项或前 n 项和）
    if re_has(t, "每[天日周月年次][^。%]{0,12}(增加|递增|递减|减少|提高|提升|多[爬走跑产]|新增)(?![^。]{0,3}%)") or \
            re_has(t, "比[上前]一[天日周月年层次]多") or re_has(t, "每层比下一层多") or \
            has(t, "依次递减相同", "依次递增相同"):
        return "SL-SZ-01", 0.85
    if has(t, "连续整数", "连续自然数", "连续奇数", "连续偶数"):
        return "SL-SZ-01", 0.8
    if re_has(t, "每[按加提][^。]{0,12}倍") or re_has(t, "提高到当前的") or re_has(t, "每[天日周月年][^。]{0,10}是[前上]一[天日周月年]的") or \
            (re_has(t, "每年增长\\s?\\d+(\\.\\d+)?%") and has(t, "第", "年")):
        return "SL-SZ-02", 0.8
    if re_has(t, "每[天日周月年][^。]{0,10}增长\\s?\\d+(\\.\\d+)?%"):
        return "SL-SZ-02", 0.8
    if has(t, "等差"):
        return "SL-SZ-01", 0.85
    if has(t, "等比"):
        return "SL-SZ-02", 0.85
    if has(e, "分数数列", "分子", "分母", "多重数列", "交叉", "分组", "奇数项", "偶数项"):
        return "SL-SZ-05", 0.8
    if has(e, "幂次", "次方", "平方数", "立方数") or re_has(e, "平方(?![米公厘])") or re_has(e, "立方(?![米厘分])"):
        return "SL-SZ-04", 0.8
    if has(e, "递推", "前两项", "前一项", "相邻两项"):
        return "SL-SZ-03", 0.75
    seq = parse_seq(q)
    if seq:
        if any("/" in x for x in re.findall(r"\d+/\d+", q)):
            return "SL-SZ-05", 0.75
        code, conf = seq_kind(seq)
        if code:
            return code, conf
        return "SL-SZ-03", 0.5  # 无明显等差等比幂次，多为递推
    if "/" in q or "分数" in q:
        return "SL-SZ-05", 0.6
    return None, 0


def topic_qt(q, e, sub, t):
    if sub == "方阵问题" or has(t, "方阵", "最外层", "空心方阵", "实心方阵"):
        return "SL-QT-02", 0.9
    return "SL-QT-01", 0.85


TOPIC_FN = {
    "SL-JS": topic_js, "SL-XC": topic_xc, "SL-GC": topic_gc, "SL-JJ": topic_jj,
    "SL-PL": topic_pl, "SL-JH": topic_jh, "SL-ZZ": topic_zz, "SL-RC": topic_rc,
    "SL-ZQ": topic_zq, "SL-TC": topic_tc, "SL-ND": topic_nd, "SL-NL": topic_nl,
    "SL-SZ": topic_sz, "SL-QT": topic_qt,
}


def classify(d):
    q = d.get("question") or ""
    e = d.get("explanation") or ""
    sub = (d.get("submodule") or "").strip() or None
    t = q + "\n" + e
    group = SUBMODULE_GROUP.get(sub) if sub else None
    if group is None:
        group = detect_group(t)
    if group is None:
        return "UNKNOWN", 0.0
    fn = TOPIC_FN[group]
    code, conf = fn(q, e, sub, t)
    if code is None:
        return "UNKNOWN", 0.0
    return code, conf


def main():
    untagged, taxonomy_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    mod = load_taxonomy(taxonomy_path)
    valid = {tp["code"] for g in mod["groups"] for tp in g["topics"]}
    stats = Counter()
    n = 0
    with open(out_path, "w", encoding="utf-8") as out, open(untagged, encoding="utf-8") as src:
        for line in src:
            d = json.loads(line)
            code, conf = classify(d)
            if code != "UNKNOWN" and code not in valid:
                raise SystemExit(f"invalid code {code}")
            rec = {"id": d["id"], "tag3": code,
                   "confidence": round(conf, 2), "method": "rule"}
            out.write(json.dumps(rec, ensure_ascii=False) + "\n")
            stats[code] += 1
            n += 1
    print(f"total={n}")
    for k, v in stats.most_common():
        print(f"{k}\t{v}")


if __name__ == "__main__":
    main()
