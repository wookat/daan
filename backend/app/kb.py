"""知识库：花生十三主体系 + 补充名师体系（申论名师 shenlun-skill、小P判断推理），均来自公开开源整理。"""
import os

_KNOW = os.path.join(os.path.dirname(__file__), "..", "..", "knowledge")
KB_DIR = os.path.join(_KNOW, "references")

# 补充方法库：模块 -> (体系名, 目录, 文件列表)
EXTRA_SCHOOLS = {
    "shenlun": [
        (
            "申论名师体系（李梦圆/小马哥/白鹭/袁东等，源自开源 shenlun-skill）",
            os.path.join(_KNOW, "shenlun-mingshi"),
            ["danyiti-guina.md", "zonghe-fenxi.md", "duice-tichu.md", "gongwen-xiezuo.md", "dazuowen.md", "guifan-biaoda.md"],
        ),
        (
            "小马哥/白鹭/袁东方法论（源自开源 Shenlun.skill）",
            os.path.join(_KNOW, "shenlun-smbl"),
            ["xiaoma-methodology.md", "bai-lu-methodology.md", "yuan-dong-methodology.md", "writing-rules.md", "scoring-rules.md"],
        ),
    ],
    "yanyu": [
        (
            "郭熙言语复盘法（源自开源 kaogong-review-skill，MIT）",
            os.path.join(_KNOW, "fupan"),
            ["言语复盘流程.md"],
        ),
    ],
    "panduan": [
        (
            "小P考场排除法体系（源自开源 xiaop-judgment-reasoning）",
            os.path.join(_KNOW, "xiaop"),
            ["formal-logic-arrangement.md", "argumentation.md", "analogy-definition.md", "graphics-spatial.md"],
        ),
        (
            "薛睿/刘义恒复盘法（源自开源 kaogong-review-skill，MIT）",
            os.path.join(_KNOW, "fupan"),
            ["判断推理复盘流程.md", "图推复盘流程.md"],
        ),
    ],
    "changshi": [
        (
            "通用公考体系（源自开源 KeWang0622/kaogong-skill，MIT）",
            os.path.join(_KNOW, "kw-general"),
            ["kaogong-skill.md"],
        ),
    ],
}

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
    for school, sdir, files in EXTRA_SCHOOLS.get(module_key, []):
        sparts = []
        sbudget = 12000
        for fname in files:
            path = os.path.join(sdir, fname)
            if not os.path.exists(path):
                continue
            with open(path, encoding="utf-8") as f:
                text = f.read()
            take = text[: sbudget // len(files) + 1000]
            sparts.append(f"<<< {fname} >>>\n{take}")
            sbudget -= len(take)
            if sbudget <= 0:
                break
        if sparts:
            parts.append(f"=== 补充体系：{school}（可作第二解法视角，引用时须标明体系名）===\n" + "\n\n".join(sparts))
    return "\n\n".join(parts)


def guess_module(question_text: str) -> str | None:
    scores = {}
    for key, mod in MODULES.items():
        scores[key] = sum(1 for kw in mod["keywords"] if kw in question_text)
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else None
