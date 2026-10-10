"""W13-C1 内容门禁：R8–R13 纯函数正/反例、批次阈值、fail-closed、dry-run 只读。"""
import json
import os
import sqlite3
import subprocess
import sys

import pytest

from app import content_gate, db, deps, quality

from .conftest import seed_questions

_TOKEN = "test-import-token"
_HS_OK = "第一步：由题干可知总量为 120。第二步：代入选项排除 B、C。因此故选 A。"
_TOOL = os.path.join(os.path.dirname(__file__), "..", "tools", "content_gate_dryrun.py")


def _q(qid: int) -> dict:
    conn = db.get_conn()
    row = dict(conn.execute("SELECT * FROM questions WHERE id=?", (qid,)).fetchone())
    conn.close()
    return row


def _count() -> int:
    conn = db.get_conn()
    n = conn.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    conn.close()
    return n


def _post(client, path, items):
    return client.post(path, headers={"X-Import-Token": _TOKEN}, json={"items": items})


# ---------------- R8 hs_answer_reference ----------------
@pytest.mark.parametrize("text", [
    "代入验证，结果与题给答案一致，故选 B。",  # q376665
    "官方解析已定位到第三段，据此排除 A、C。",  # q265323
    "参考答案为 C，套用比重公式即可。",
    "该题标准答案是 D。",
])
def test_r8_positive(text):
    assert quality.hs_answer_reference(text)


@pytest.mark.parametrize("text", [
    "第一步：由题干可知总量为 120，故选 A。",
    "对照选项，B 项与题干数据矛盾，排除。",
    "参考图表第二列，2023 年增速为 8%。",
    "",
    None,
])
def test_r8_negative(text):
    assert not quality.hs_answer_reference(text)


# ---------------- R9 hollow_exclusion ----------------
@pytest.mark.parametrize("text", [
    "B项指出了因果倒置。A、B、D均是绝对化或无据判断。",
    "A、C无关，D 计算错误。故选 B。",
    "B、C、D均不符。",
])
def test_r9_positive(text):
    assert quality.hollow_exclusion(text)


@pytest.mark.parametrize("text", [
    "A、C为包含关系，D为容纳关系，与题干「交叉」不符。",
    "B、D因为“十三五”说的是 2016 年，与题干时间无关。",
    "A 项无关；B 项对应第二段。",  # 单字母句首
    "A、B、C 均属于并列关系，D 属于因果关系。",
    "",
])
def test_r9_negative(text):
    assert not quality.hollow_exclusion(text)


# ---------------- R10 shell_signature ----------------
_SHELL_A = "2023年A市GDP为1200亿元，同比增长8%，则2022年约为1111亿元，故选A。"
_SHELL_B = "2022年B市GDP为3400亿元，同比增长12%，则2021年约为3036亿元，故选C。"
_SHELL_C = "2021年C市GDP为560亿元，同比增长5%，则2020年约为533亿元，故选D。"  # q145225 组整段复用


def test_r10_positive():
    sa, sb, sc = (quality.shell_signature(t) for t in (_SHELL_A, _SHELL_B, _SHELL_C))
    assert sa == sb == sc
    assert quality.shell_similar(sa, sb) and quality.shell_similar(sb, sc)


def test_r10_negative():
    other = quality.shell_signature("由「所有 S 是 P」不能推出「所有 P 是 S」，A 项换位不当，排除；C 项符合三段论，故选 C。")
    assert not quality.shell_similar(quality.shell_signature(_SHELL_A), other)
    assert not quality.shell_similar("", quality.shell_signature(_SHELL_A))
    assert not quality.shell_similar(quality.shell_signature(_HS_OK), other)


# ---------------- R11 arith_suspect ----------------
@pytest.mark.parametrize("text", ["总量 12×3=48，故选 B。", "增量为 100+20=125。", "1200÷3=350。", "共 12 × 3 = 48 元"])
def test_r11_positive(text):
    assert quality.arith_suspect(text)


@pytest.mark.parametrize("text", [
    "12×3=36，故选 A。",
    "约 12×3=48（取整估算）。",  # 约等前缀不判
    "12%×3=48",  # 百分比不判
    "2023年-2019年=4年",  # 非纯数字三元
    "1200÷3=400，误差 1% 以内 399=399",
    "至少会一种=A+B-交集=30+20-8=42人",  # 连式非三元（生产 q71 抽检）
    "代中间选项n=10：2×100+10=210，恰好成立",  # 连式非三元（生产 q72 抽检）
    "40/12=3余4，最不利情况每月3人",  # 斜杠整除带余数（生产 q430 抽检）
    "可兑换820/50=16次（取整）",  # 斜杠取整（生产 q2747 抽检）
    "1200÷12=100余0",
    "8 × 1.25 = 8 + 8 × 0.25 = 8 + 2 = 10亿元",  # 带空格连式（生产 q16907 抽检）
    "验算：5 + 3 + 2 + 2 = 12，成立",  # 带空格连式（生产 q17283 抽检）
    "年省 112×800=8.96万元",  # 结果带万量级（生产 q8094 抽检）
    "成本 25 x 100 + 200 = 2700元",  # ASCII x 连式（生产 q150059 抽检）
    "第3个周六=6+14=9月20日",  # 日期（生产 q152419 抽检）
])
def test_r11_negative(text):
    assert not quality.arith_suspect(text)


# ---------------- R12 synthetic_family_key ----------------
_FAMILY_STEM = "2024年某省粮食产量同比增长28%（2023年为1000万吨），其中四类分别占40%、30%、20%、10%。据此回答下列小题。问题：2023年产量为多少？"


def test_r12_positive():
    assert quality.synthetic_family_key({"source": "original", "question": _FAMILY_STEM})
    assert quality.synthetic_family_key({"source": "original", "question": "去年同比增长28%（2023年为800万吨）。"})


def test_r12_negative():
    assert quality.synthetic_family_key({"source": "2024年国家公务员考试行测真题", "question": _FAMILY_STEM}) is None
    assert quality.synthetic_family_key({"source": "original", "question": "某市2024年GDP同比增长7%，问增速排名？"}) is None
    assert quality.synthetic_family_key({"source": "original", "question": "同比增长28%，问基期？"}) is None  # 只命中 1 项


# ---------------- R13 clone_key ----------------
_OPTS = {"A": "20", "B": "25", "C": "30", "D": "40"}


def test_r13_positive():
    a = quality.clone_key("甲乙两人从相距100米处相向而行，速度分别为3米/秒和2米/秒，几秒相遇？", _OPTS)
    b = quality.clone_key("甲乙两人从相距200米处相向而行，速度分别为5米/秒和3米/秒，几秒相遇？", json.dumps(_OPTS))
    assert a[0] == b[0] and a[1] == b[1]
    assert quality.is_clone(a, b)
    assert quality.is_clone(a, quality.clone_key("甲乙两人从相距100米处相向而行，速度分别为3米/秒和2米/秒，几秒后相遇？", _OPTS))


def test_r13_negative():
    a = quality.clone_key("甲乙两人从相距100米处相向而行，速度分别为3米/秒和2米/秒，几秒相遇？", _OPTS)
    assert not quality.is_clone(a, quality.clone_key("甲乙两人从相距100米处相向而行，速度分别为3米/秒和2米/秒，几秒相遇？", {**_OPTS, "D": "50"}))
    assert not quality.is_clone(a, quality.clone_key("一项工程甲单独做需 10 天，乙需 15 天，合作需几天？", _OPTS))
    assert not quality.is_clone(a, quality.clone_key("", _OPTS))


# ---------------- gate_hs / hs_import 路由 ----------------
def test_hs_import_r8_rejected_item_not_written(client, monkeypatch):
    monkeypatch.setattr(deps, "IMPORT_TOKEN", _TOKEN)
    q1, q2 = seed_questions()[:2]
    before = _q(q1)
    r = _post(client, "/api/questions/hs_import", [
        {"id": q1, "hs_explanation": _HS_OK + "代入验证，与题给答案一致。"},
        {"id": q2, "hs_explanation": "由「所有 S 是 P」不能推出「所有 P 是 S」，A 项换位不当，排除；C 项符合三段论，故选 C。"},
    ])
    assert r.status_code == 200
    body = r.json()
    assert body["updated"] == 1
    assert body["receipt"]["rejected"] == [{"id": q1, "rule": "R8"}]
    assert body["receipt"]["batch_rejected"] is False
    assert _q(q1)["hs_explanation"] == before["hs_explanation"]
    assert _q(q2)["hs_explanation"].startswith("由「所有")


def test_hs_import_r10_batch_rejected_422(client, monkeypatch):
    monkeypatch.setattr(deps, "IMPORT_TOKEN", _TOKEN)
    ids = seed_questions()[:3]
    before = [_q(i)["hs_explanation"] for i in ids]
    r = _post(client, "/api/questions/hs_import", [
        {"id": ids[0], "hs_explanation": _SHELL_A},
        {"id": ids[1], "hs_explanation": _SHELL_B},
        {"id": ids[2], "hs_explanation": _SHELL_C},
    ])
    assert r.status_code == 422
    receipt = r.json()["detail"]["receipt"]
    assert receipt["batch_rejected"] is True and receipt["reason"].startswith("R10")
    assert {f["id"] for f in receipt["flagged"]} == set(ids)
    assert [_q(i)["hs_explanation"] for i in ids] == before


def test_hs_import_r9_batch_rejected_422(client, monkeypatch):
    monkeypatch.setattr(deps, "IMPORT_TOKEN", _TOKEN)
    ids = seed_questions()[:3]
    items = [
        {"id": ids[0], "hs_explanation": "B 项指出了因果倒置，削弱最强。A、C、D均是绝对化或无据判断。"},
        {"id": ids[1], "hs_explanation": "C 项补充了前提。A、B无关，D 计算错误。"},
        {"id": ids[2], "hs_explanation": "D 项换位正确。A、B、C均不符。"},
    ]
    r = _post(client, "/api/questions/hs_import", items)
    assert r.status_code == 422
    assert r.json()["detail"]["receipt"]["reason"].startswith("R9")
    # 两条 R9 只软标不拒批
    r = _post(client, "/api/questions/hs_import", items[:2])
    assert r.status_code == 200
    assert r.json()["updated"] == 2
    assert {f["id"] for f in r.json()["receipt"]["flagged"] if "R9" in f["rules"]} == set(ids[:2])


def test_hs_import_r10_against_stored_soft_flag_only(client, monkeypatch):
    monkeypatch.setattr(deps, "IMPORT_TOKEN", _TOKEN)
    ids = seed_questions()[:2]
    conn = db.get_conn()
    conn.execute("UPDATE questions SET submodule='增长率' WHERE id IN (?,?)", ids)
    conn.commit()
    conn.close()
    assert db.import_hs_explanations([{"id": ids[0], "hs_explanation": _SHELL_A}]) == 1
    r = _post(client, "/api/questions/hs_import", [{"id": ids[1], "hs_explanation": _SHELL_B}])
    assert r.status_code == 200
    assert r.json()["updated"] == 1
    assert r.json()["receipt"]["flagged"] == [{"id": ids[1], "rules": ["R10"]}]


def test_hs_import_fail_closed(client, monkeypatch):
    monkeypatch.setattr(deps, "IMPORT_TOKEN", _TOKEN)
    q1 = seed_questions()[0]
    before, n0 = _q(q1), _count()

    def boom(_text):
        raise RuntimeError("rule exploded")

    monkeypatch.setattr(quality, "hollow_exclusion", boom)
    r = _post(client, "/api/questions/hs_import", [{"id": q1, "hs_explanation": _HS_OK}])
    assert r.status_code == 422
    receipt = r.json()["detail"]["receipt"]
    assert receipt["batch_rejected"] is True and "gate_error" in receipt["reason"]
    assert _q(q1)["hs_explanation"] == before["hs_explanation"]
    assert _count() == n0


# ---------------- gate_questions / questions/import 路由 ----------------
def _orig(stem, opts=None, sub="增长率", **kw):
    return {"module": "ziliao", "question_type": "单选题", "question": stem, "options": opts or {"A": "1", "B": "2", "C": "3", "D": "4"},
            "answer": "A", "explanation": "解析。", "source": "original", "submodule": sub, **kw}


def test_questions_import_keeps_keys_and_flags_r12_r13(client, monkeypatch):
    monkeypatch.setattr(deps, "IMPORT_TOKEN", _TOKEN)
    n0 = _count()
    r = _post(client, "/api/questions/import", [_orig(_FAMILY_STEM + " 甲"), _orig("W13 独立题干：某市 2024 年 GDP 为 100 亿元，同比增长 5%，问 2023 年？")])
    assert r.status_code == 200
    body = r.json()
    assert set(body) >= {"inserted", "skipped", "batch", "receipt"}
    assert body["inserted"] == 2 and _count() == n0 + 2
    assert body["receipt"]["flagged"] == [{"id": 0, "rules": ["R12"]}]  # 合成题族软标，独立题不标
    # 第二批：与库内同 submodule 存量 original 行克隆 → R13 软标但放行
    r = _post(client, "/api/questions/import", [
        _orig(_FAMILY_STEM + " 乙"),
        _orig("W13 独立题干：某市 2023 年 GDP 为 200 亿元，同比增长 6%，问 2022 年？"),
    ])
    assert r.status_code == 200
    body = r.json()
    assert body["inserted"] == 2 and body["receipt"]["batch_rejected"] is False
    rules = {f["id"]: f["rules"] for f in body["receipt"]["flagged"]}
    assert "R12" in rules[0] and "R13" in rules[0] and rules[1] == ["R13"]


def test_questions_import_r8_item_rejected_and_fail_closed(client, monkeypatch):
    monkeypatch.setattr(deps, "IMPORT_TOKEN", _TOKEN)
    n0 = _count()
    r = _post(client, "/api/questions/import", [
        _orig("W13 R8 题干甲", explanation="参考答案为 A。", sub="比重"),
        _orig("W13 R8 题干乙，正常解析", sub="比重"),
    ])
    assert r.status_code == 200
    assert r.json()["inserted"] == 1 and r.json()["receipt"]["rejected"] == [{"id": 0, "rule": "R8"}]
    assert _count() == n0 + 1

    def boom(*_a, **_k):
        raise ValueError("clone exploded")

    monkeypatch.setattr(quality, "clone_key", boom)
    n1 = _count()
    r = _post(client, "/api/questions/import", [_orig("W13 fail-closed 题干", sub="比重")])
    assert r.status_code == 422
    assert r.json()["detail"]["receipt"]["batch_rejected"] is True
    assert _count() == n1


def test_gate_is_pure_read_only():
    conn = db.get_conn()
    dv0 = conn.execute("PRAGMA data_version").fetchone()[0]
    n0 = conn.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    conn.close()
    accepted, receipt = content_gate.gate_questions([_orig(_FAMILY_STEM), _orig(_FAMILY_STEM + "。")])
    assert len(accepted) == 2 and receipt["batch_rejected"] is False
    accepted, receipt = content_gate.gate_hs([])
    assert accepted == [] and receipt == {"rejected": [], "flagged": [], "batch_rejected": False, "reason": None}
    conn = db.get_conn()
    assert conn.execute("PRAGMA data_version").fetchone()[0] == dv0
    assert conn.execute("SELECT COUNT(*) FROM questions").fetchone()[0] == n0
    conn.close()


# ---------------- dry-run 脚本只读 ----------------
def test_dryrun_script_read_only(tmp_path):
    seed_questions()
    # 复制到独立文件：共享 test.db 上其它用例的后台线程可能提交，会干扰 data_version 对比
    db_path = str(tmp_path / "seed.db")
    src = sqlite3.connect(os.environ["DB_PATH"])
    dst = sqlite3.connect(db_path)
    src.backup(dst)
    src.close()
    dst.close()
    out = tmp_path / "ledger.md"
    ro = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    dv0 = ro.execute("PRAGMA data_version").fetchone()[0]
    n0 = ro.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    proc = subprocess.run(
        [sys.executable, _TOOL, "--db", db_path, "--out", str(out), "--module", "ziliao", "--limit", "500"],
        capture_output=True, text=True, encoding="utf-8", timeout=120, check=False,
    )
    assert proc.returncode == 0, proc.stderr
    assert ro.execute("PRAGMA data_version").fetchone()[0] == dv0
    assert ro.execute("SELECT COUNT(*) FROM questions").fetchone()[0] == n0
    ro.close()
    text = out.read_text(encoding="utf-8")
    assert "# W13 内容门禁 dry-run 台账" in text and "| R8 |" in text and "| R13 |" in text
    assert "module=ziliao limit=500" in text
