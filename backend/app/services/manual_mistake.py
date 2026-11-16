"""手录错题（source='manual'）：用户在错题本自由录入的选择题，不对回题库、不走 AI。

与时政/AI 内联错题同为 question_id=NULL 行，后续复习/重练/PDF 走既有内联路径；
本模块只做入库前归一与校验，非法输入回 ValueError 由接口层转 400。"""
import re

MANUAL_SOURCE = "manual"
MANUAL_MODULES = {"ziliao", "shuliang", "yanyu", "panduan", "changshi", "时政"}
MANUAL_REASONS = {"粗心大意", "概念不清", "方法不会", "纯蒙的"}
QUESTION_MAX = 2000
EXPLANATION_MAX = 2000
_LETTERS = re.compile(r"[A-D]")


def _letters(v) -> str:
    return "".join(sorted(set(_LETTERS.findall(str(v or "").upper()))))


def _text(v, limit: int) -> str:
    s = re.sub(r"[ \t\u3000]+", " ", str(v or "").replace("\r", ""))
    s = "\n".join(ln.strip() for ln in s.split("\n")).strip()
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s[:limit]


def is_manual(rec) -> bool:
    return isinstance(rec, dict) and rec.get("source") == MANUAL_SOURCE


def normalize(rec: dict) -> dict:
    """归一手录错题；字段非法时抛 ValueError(中文原因)。"""
    uid = str(rec.get("uid") or "").strip()[:64]
    if not uid:
        raise ValueError("缺少 uid")
    module = str(rec.get("module") or "").strip()
    if module not in MANUAL_MODULES:
        raise ValueError("请选择模块")
    question = _text(rec.get("question_text"), QUESTION_MAX)
    if len(question) < 2:
        raise ValueError("请填写题干")
    correct = _letters(rec.get("correct_answer"))
    if not correct:
        raise ValueError("请选择正确答案（A-D）")
    picked = _letters(rec.get("user_answer"))
    if picked and picked == correct:
        raise ValueError("我的答案与正确答案相同，不算错题")
    reason = str(rec.get("error_reason") or "").strip()
    explanation = _text(rec.get("explanation"), EXPLANATION_MAX)
    return {
        "uid": uid,
        "module": module,
        "question_type": None,
        "question_text": question,
        "correct_answer": correct,
        "user_answer": picked or None,
        "error_reason": reason if reason in MANUAL_REASONS else None,
        "explanation": explanation or None,
        "question_id": None,
        "source": MANUAL_SOURCE,
    }
