"""知识库：加载花生十三方法体系（来自开源项目 huasheng13-skill，公开教学体系整理）。"""
import os

KB_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "knowledge", "references")

MODULES = {
    "ziliao": {
        "name": "资料分析",
        "files": ["ziliao-fenxi.md", "ziliao-susuan.md", "ziliao-zonghe.md"],
        "keywords": ["增长率", "增长量", "基期", "现期", "比重", "平均数", "同比", "环比", "统计", "图表", "万元", "亿元"],
    },
    "shuliang": {
        "name": "数量关系",
        "files": ["shuliang-guanxi.md", "shuliang-gongshi.md"],
        "keywords": ["工程", "行程", "利润", "排列", "组合", "概率", "容斥", "年龄", "几何", "溶液", "牛吃草", "鸡兔同笼", "最值"],
    },
    "yanyu": {
        "name": "言语理解",
        "files": ["yanyu-lianjie.md", "yanyu-ciyu.md", "yanyu-zhuanxiang.md"],
        "keywords": ["填入", "横线", "画线", "这段文字", "主旨", "意在", "标题", "排序", "衔接", "语句"],
    },
    "panduan": {
        "name": "判断推理",
        "files": ["panduan-tuili.md", "panduan-guilv.md", "panduan-tuxing.md"],
        "keywords": ["定义", "类比", "图形", "推理", "加强", "削弱", "前提", "结论", "翻译", "真假", "逻辑"],
    },
    "changshi": {
        "name": "常识判断",
        "files": ["changshi-panduan.md", "shizheng-redian.md"],
        "keywords": ["下列说法", "正确的是", "错误的是", "法律", "历史", "地理", "科技", "时政"],
    },
    "shenlun": {
        "name": "申论",
        "files": ["shenlun.md", "shenlun-biaoda.md", "shenlun-sucai.md"],
        "keywords": ["申论", "概括", "对策", "公文", "大作文", "给定资料"],
    },
}


def load_method_text(module_key: str, max_chars: int = 24000) -> str:
    mod = MODULES.get(module_key)
    if not mod:
        return ""
    parts = []
    budget = max_chars
    for fname in mod["files"]:
        path = os.path.join(KB_DIR, fname)
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            text = f.read()
        take = text[: budget // len(mod["files"]) + 4000]
        parts.append(f"<<< 方法文件：{fname} >>>\n{take}")
        budget -= len(take)
        if budget <= 0:
            break
    return "\n\n".join(parts)


def guess_module(question_text: str) -> str | None:
    scores = {}
    for key, mod in MODULES.items():
        scores[key] = sum(1 for kw in mod["keywords"] if kw in question_text)
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else None
