"""根据 question_type 规范化出二级题型 submodule 字段。"""
import json
import sys

TAXONOMY = {
    "yanyu": ["逻辑填空", "中心理解", "细节理解", "语句表达", "其他"],
    "panduan": ["图形推理", "定义判断", "类比推理", "逻辑判断", "其他"],
    "shuliang": ["行程问题", "工程问题", "经济利润", "几何问题", "排列组合与概率", "数列问题", "其他应用题"],
    "ziliao": ["增长问题", "比重问题", "平均数与倍数", "基期现期", "综合分析", "其他"],
    "changshi": ["政治", "法律", "经济", "科技", "历史人文", "地理", "其他"],
}

RULES = {
    "yanyu": [
        ("逻辑填空", ["逻辑填空", "选词填空", "实词", "成语"]),
        ("中心理解", ["主旨", "意图", "中心理解", "标题"]),
        ("细节理解", ["细节"]),
        ("语句表达", ["语句排序", "语句填空", "下文推断", "语句衔接", "接语", "排序"]),
    ],
    "panduan": [
        ("图形推理", ["图形"]),
        ("定义判断", ["定义"]),
        ("类比推理", ["类比"]),
        ("逻辑判断", ["逻辑", "翻译推理", "加强", "削弱", "真假", "结论", "解释", "分析推理", "论证"]),
    ],
    "shuliang": [
        ("行程问题", ["行程", "相遇", "追及", "流水"]),
        ("工程问题", ["工程"]),
        ("经济利润", ["经济", "利润", "折扣", "利率"]),
        ("几何问题", ["几何", "面积", "体积", "周长"]),
        ("排列组合与概率", ["排列", "组合", "概率"]),
        ("数列问题", ["数列", "等差", "等比", "数字推理"]),
    ],
    "ziliao": [
        ("增长问题", ["增长", "增速", "增量", "拉动", "隔年", "年均"]),
        ("比重问题", ["比重"]),
        ("平均数与倍数", ["平均", "倍数", "翻番"]),
        ("基期现期", ["基期", "现期"]),
        ("综合分析", ["综合"]),
    ],
    "changshi": [
        ("政治", ["政治", "时政", "党", "马克思", "理论"]),
        ("法律", ["法律", "法", "宪法", "民法", "刑法", "行政法"]),
        ("经济", ["经济", "金融", "货币"]),
        ("科技", ["科技", "物理", "化学", "生物", "医学", "生活常识"]),
        ("历史人文", ["历史", "人文", "文化", "文学", "艺术", "传统"]),
        ("地理", ["地理", "环境", "自然"]),
    ],
}


def classify(module: str, qtype: str) -> str:
    for sub, kws in RULES.get(module, []):
        if any(k in qtype for k in kws):
            return sub
    return TAXONOMY[module][-1]


def main(path: str) -> None:
    rows = [json.loads(l) for l in open(path, encoding="utf-8")]
    from collections import Counter
    c: Counter = Counter()
    for r in rows:
        r["submodule"] = classify(r["module"], r.get("question_type", ""))
        c[(r["module"], r["submodule"])] += 1
    with open(path, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    for k, v in sorted(c.items()):
        print(v, k)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "knowledge/questions_bank.jsonl")
