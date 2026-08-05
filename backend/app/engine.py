"""讲解引擎：题目识别 → 题型路由 → 按花生十三方法体系讲解。"""
import re

from . import kb, llm

EXTRACT_PROMPT = """你是公务员考试题目识别助手。从用户提供的内容（图片或文字）中提取题目信息，输出 JSON（不要多余文字）：
{
  "question_text": "完整题干（含选项 A/B/C/D，若有）",
  "module": "ziliao|shuliang|yanyu|panduan|changshi|shenlun 之一",
  "question_type": "更细的子题型，如：资料分析-增长率比较、判断推理-定义判断",
  "user_answer": "若图中可见用户所选答案则填，否则 null",
  "marked_correct_answer": "若图中标注了正确答案则填，否则 null"
}
module 判断标准：资料分析(统计材料+计算)=ziliao；数学应用题=shuliang；词语填空/主旨/排序=yanyu；图形/定义/类比/逻辑=panduan；百科知识=changshi；申论材料题=shenlun。"""

EXPLAIN_SYSTEM = """你是一位深谙"花生十三"解题体系的公考老师，同时掌握方法库中标注的补充名师体系。你必须严格使用下方提供的方法库中的技巧来讲解，遵守：
1. 先给"题型识别"：这题属于哪个模块哪个子题型，触发哪个方法（引用方法库中的方法名称，如"截位直除""415份数""ABRX"）。
2. 按方法库中该方法的标准操作步骤分步讲解，资料分析/数量关系必须展示速算过程。
3. 给出答案和"易错点"。
4. 若用户答错了，分析错因（方法不会/看错题/计算失误/掉入陷阱）。
5. 【红线-防编造】先判断题目是否完整可解：若题干残缺、乱码、数据矛盾或无法确定唯一答案，第一行写「【答案】题目存疑」，并明确说明哪里不完整/有误、需要补充什么信息，绝不强行拼凑解释，也不得给出任何猜测性答案或选项倾向（如"可能对应 D"）；存疑时正文中禁止出现任何选项字母或"若猜测……"式推断，只说明缺什么信息。
6. 【红线-一致性】先在内心完成全部推理再下笔：第一行【答案】必须与正文最终结论完全一致，正文中不得出现与答案行矛盾的结论。
7. 【红线】主解法优先用花生十三体系；若方法库中标注了"补充体系"，可引用其方法作为第二解法视角或主解法（如申论），但必须标明体系名（如"小P体系""袁东方法"）。如果所需方法不在任何已提供方法库中，必须明确说"该题型方法不在当前方法库中"，再给通用解法并明确区分标注，绝不允许编造归属于任何老师的方法。
8. 用手机阅读友好的 Markdown 输出，简明扼要。题干关键词、关键数字用 **加粗**。
9. 【格式】禁止使用 LaTeX（\\[ \\] \\frac 等），所有算式用纯文本，如：1200 ÷ 1.08 ≈ 1111。
10. 速算/列式过程必须放在 ``` 代码块中单独展示。

输出结构（严格遵守，第一行必须是答案行）：
【答案】X｜【方法】方法名｜【一句话】不超过30字的核心思路
## 题型识别
## 方法与步骤
（分步讲解，每一步用三级标题 "### 第N步：动作名" 开头，如 "### 第1步：锁定总量"，共 2~6 步）
## 答案
## 快解技巧（若该题存在更快的秒杀思路——如代入排除、尾数法、选项特征、量级估算——用 2~4 行给出；确实没有则省略本节，不得硬编）
## 错项击破（仅选择题：其余每个错误选项一行，说明为何错/陷阱在哪）
## 易错点
## 错因分析（仅当用户答错时）
注：选择题【答案】填选项字母；无选项题填结论要点。

=== 花生十三方法库（节选，仅可引用其中方法）===
{methods}
"""


async def extract_question(image_b64: str | None, mime: str | None, text: str | None) -> dict:
    if image_b64:
        content = llm.image_content(image_b64, mime or "image/jpeg", EXTRACT_PROMPT)
    else:
        content = EXTRACT_PROMPT + "\n\n题目内容：\n" + (text or "")
    try:
        data = await llm.chat_json([{"role": "user", "content": content}], fast=not image_b64, max_tokens=2000)
    except (ValueError, KeyError, TypeError):
        data = {}
    if not isinstance(data, dict):
        data = {}
    data["question_text"] = data.get("question_text") or ""
    if data.get("module") not in kb.MODULES:
        guessed = kb.guess_module(data.get("question_text", ""))
        data["module"] = guessed or "panduan"
    return data


SIMILAR_SYSTEM = """你是公考出题老师。根据用户给出的原题，出一道考察同一方法/技巧的新题（自编数据，不照搬真题原文），难度相当。
输出 Markdown：
## 练习题
（题干+选项 A/B/C/D）
## 提示
（一句话点出该用什么方法，不透露答案）
<!--answer-->
## 答案与解析
（答案+按方法分步简解）
必须包含 <!--answer--> 分隔标记。禁止 LaTeX，算式用纯文本。"""


async def similar_question(question_text: str, question_type: str | None = None) -> str:
    user_msg = f"原题（题型：{question_type or '未知'}）：\n{question_text}"
    return await llm.chat(
        [
            {"role": "system", "content": SIMILAR_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.7,
        max_tokens=2000,
    )


FOLLOWUP_SYSTEM = """你是公考 AI 学习助手，正在就一道题目和它的讲解回答学生的追问。
要求：只围绕这道题和相关方法/考点回答；简明扼要、手机友好的 Markdown；禁止 LaTeX，算式用纯文本；不知道就说不知道，不编造。"""


async def followup(question_text: str, explanation: str, history: list, query: str) -> str:
    msgs = [
        {"role": "system", "content": FOLLOWUP_SYSTEM},
        {"role": "user", "content": f"题目：\n{question_text}\n\n讲解：\n{explanation[:3000]}"},
        {"role": "assistant", "content": "好的，我已了解这道题及讲解，请提出你的疑问。"},
    ]
    for h in (history or [])[-6:]:
        role = "user" if h.get("role") == "user" else "assistant"
        msgs.append({"role": role, "content": str(h.get("content", ""))[:1000]})
    msgs.append({"role": "user", "content": query})
    return await llm.chat_fast(msgs, max_tokens=1500)


def _explain_messages(extracted: dict, user_answer: str | None = None) -> list:
    module = extracted["module"]
    methods = kb.load_method_text(module)
    ua = user_answer or extracted.get("user_answer")
    user_msg = f"题目：\n{extracted['question_text']}\n\n题型：{extracted.get('question_type', '')}"
    if ua:
        user_msg += f"\n\n我选了：{ua}（请判断对错并分析错因）"
    if extracted.get("marked_correct_answer"):
        user_msg += f"\n（图中标注正确答案：{extracted['marked_correct_answer']}）"
    user_msg += "\n\n（提醒：输出第一行必须严格是 “【答案】X｜【方法】方法名｜【一句话】核心思路”，之后按规定的 Markdown 结构讲解）"
    return [
        {"role": "system", "content": EXPLAIN_SYSTEM.format(methods=methods)},
        {"role": "user", "content": user_msg},
    ]


_SUSPECT_TEXT = (
    "【答案】题目存疑\n\n"
    "## 题目存疑\n"
    "题干无法识别为完整的考试题目（缺少可读的中文题干或明确的提问）。"
    "为避免误导，不做任何猜测性解答。\n\n"
    "请补充：完整题干文字（含数据/材料）、明确的提问，以及规范的选项内容后再试。"
)


def is_suspect(question_text: str) -> bool:
    return _suspect_reason(question_text)


def _suspect_reason(question_text: str) -> bool:
    stem = re.split(r"\bA[\.．、:：]", question_text or "", maxsplit=1)[0]
    hanzi = len(re.findall(r"[\u4e00-\u9fff]", stem))
    return hanzi < 8


async def explain(extracted: dict, user_answer: str | None = None) -> str:
    if _suspect_reason(extracted.get("question_text", "")):
        return _SUSPECT_TEXT
    return await llm.chat(_explain_messages(extracted, user_answer), max_tokens=6000)


def explain_stream(extracted: dict, user_answer: str | None = None):
    if _suspect_reason(extracted.get("question_text", "")):
        async def _fixed():
            yield _SUSPECT_TEXT
        return _fixed()
    return llm.chat_stream(_explain_messages(extracted, user_answer), max_tokens=6000)
