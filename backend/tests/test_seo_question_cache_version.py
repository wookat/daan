"""R402：/tiku/q/{id} 进程内 lru_cache 以 questions.updated_at 为版本键——隔离脚本置空 base 解析后不必重启进程。"""
import json
import time

from app import db

_SKELETON = "设第三项为 x，则 x+（2x-2）=500，解得 x=。故正确答案为 C。"
_HS = "hs 讲解：五项和 500，第三项最小时其余尽量大，得 68。"


def _seed(conn, explanation, hs, tag=""):
    cur = conn.execute(
        "INSERT INTO questions (module, question_type, question, options, answer, explanation,"
        " hs_explanation, is_real, disabled, updated_at) VALUES (?,?,?,?,?,?,?,1,0,?)",
        (
            "shuliang",
            "单选题",
            f"缓存版本测试题{tag}：五个数之和为 500，第三项最小是多少？",
            json.dumps({"A": "66", "B": "67", "C": "68", "D": "69"}, ensure_ascii=False),
            "C",
            explanation,
            hs,
            time.time() - 100,
        ),
    )
    conn.commit()
    return cur.lastrowid


def test_question_page_rerenders_after_quarantine_bumps_updated_at(client):
    conn = db.get_conn()
    qid = _seed(conn, _SKELETON, _HS)
    r = client.get(f"/tiku/q/{qid}")
    assert r.status_code == 200
    assert "原解析" in r.text and "解得 x=。" in r.text

    # 同隔离脚本 apply()：base 置空 + updated_at 刷新
    conn.execute(
        "UPDATE questions SET explanation=NULL, updated_at=? WHERE id=?", (time.time(), qid)
    )
    conn.commit()
    conn.close()

    r2 = client.get(f"/tiku/q/{qid}")
    assert r2.status_code == 200
    assert "解得 x=。" not in r2.text and "原解析" not in r2.text
    assert _HS in r2.text
    # 隔离后只剩 hs：仍标注来源，不当作官方解析静默展示
    assert "<b>花生十三讲解</b>" in r2.text
    ld = []
    for s in r2.text.split('<script type="application/ld+json">')[1:]:
        d = json.loads(s.split("</script>")[0])
        ld += d if isinstance(d, list) else [d]
    lr = next(x for x in ld if x.get("@type") == "LearningResource")
    text = json.dumps(lr, ensure_ascii=False)
    assert "解得 x=。" not in text and _HS[:12] in text


def test_question_page_raw_only_has_no_hs_label(client):
    conn = db.get_conn()
    qid = _seed(conn, "正常解析：选 C。", "", tag="（仅 base）")
    conn.close()
    r = client.get(f"/tiku/q/{qid}")
    assert r.status_code == 200
    assert "正常解析：选 C。" in r.text
    assert "花生十三讲解" not in r.text and "原解析" not in r.text and "暂无解析" not in r.text


def test_question_page_still_cached_when_row_unchanged(client):
    from app.seo import pages

    conn = db.get_conn()
    qid = _seed(conn, "正常解析：选 C。", "", tag="（不变）")
    conn.close()
    before = pages._render_question.cache_info().misses
    client.get(f"/tiku/q/{qid}")
    client.get(f"/tiku/q/{qid}")
    info = pages._render_question.cache_info()
    assert info.misses == before + 1 and info.hits >= 1
