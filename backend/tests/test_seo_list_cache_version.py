"""R403：/tiku/t/{code}/ 与 /tiku/y/{year}/{module}/ 进程内 lru_cache 以（在架数, 最新 updated_at）为版本键——
下架/隔离写库后 TTL 缓存刷新即重渲染，不必重启进程；且早期 ISO 文本 updated_at 不再盖住之后的数值写入。"""
import json
import time

from app import db

CODE = "SL-GC-01"
TEXT_TS = "2026-08-09T18:23:19Z"


def _seed(conn, text, *, updated_at, tag3=CODE, module="shuliang", year=2024):
    cur = conn.execute(
        "INSERT INTO questions (module, question_type, question, options, answer, explanation,"
        " tag3, is_real, exam_year, exam_region, disabled, updated_at) VALUES (?,?,?,?,?,?,?,1,?,?,0,?)",
        (
            module,
            "单选题",
            text,
            json.dumps({"A": "1", "B": "2", "C": "3", "D": "4"}, ensure_ascii=False),
            "A",
            "解析。",
            tag3,
            year,
            "国考",
            updated_at,
        ),
    )
    conn.commit()
    return cur.lastrowid


def _reset_ttl_caches():
    db._TAG3_COUNTS_CACHE[1] = None
    db._TAG3_LASTMOD_CACHE[1] = None
    db._YEAR_MODULE_CACHE[1] = None


def _disable(conn, qid):
    # 同 admin 一键下架 / 隔离脚本：disabled 翻转 + updated_at 刷新
    conn.execute("UPDATE questions SET disabled=1, updated_at=? WHERE id=?", (time.time(), qid))
    conn.commit()


def test_topic_page_drops_disabled_question_after_count_cache_refresh(client):
    conn = db.get_conn()
    keep = _seed(conn, "版本键专题题·保留：甲乙两数之和为 10", updated_at=time.time() - 100)
    gone = _seed(conn, "版本键专题题·待下架：甲乙两数之积为 21", updated_at=time.time() - 90)
    _reset_ttl_caches()
    r = client.get(f"/tiku/t/{CODE}/")
    assert r.status_code == 200
    assert f'href="/tiku/q/{keep}"' in r.text and f'href="/tiku/q/{gone}"' in r.text

    _disable(conn, gone)
    conn.close()
    # 计数缓存未过期：这 5 分钟内仍出旧页（与 sitemap lastmod 同源，属预期上界）
    r_stale = client.get(f"/tiku/t/{CODE}/")
    assert f'href="/tiku/q/{gone}"' in r_stale.text

    _reset_ttl_caches()  # 等价于 TTL 到期
    r2 = client.get(f"/tiku/t/{CODE}/")
    assert r2.status_code == 200
    assert f'href="/tiku/q/{keep}"' in r2.text and f'href="/tiku/q/{gone}"' not in r2.text


def test_year_page_drops_disabled_question_after_count_cache_refresh(client):
    conn = db.get_conn()
    keep = _seed(conn, "版本键年份题·保留：某年真题一", updated_at=time.time() - 100, year=2019)
    gone = _seed(conn, "版本键年份题·待下架：某年真题二", updated_at=time.time() - 90, year=2019)
    _reset_ttl_caches()
    r = client.get("/tiku/y/2019/shuliang/")
    assert r.status_code == 200
    assert f'href="/tiku/q/{keep}"' in r.text and f'href="/tiku/q/{gone}"' in r.text

    _disable(conn, gone)
    conn.close()
    _reset_ttl_caches()
    r2 = client.get("/tiku/y/2019/shuliang/")
    assert r2.status_code == 200
    assert f'href="/tiku/q/{keep}"' in r2.text and f'href="/tiku/q/{gone}"' not in r2.text


def test_list_pages_still_cached_when_nothing_changed(client):
    from app.seo import pages

    conn = db.get_conn()
    _seed(conn, "版本键命中题：不变的题", updated_at=time.time() - 100, year=2018)
    conn.close()
    _reset_ttl_caches()
    t_miss = pages._render_topic.cache_info().misses
    y_miss = pages._render_year.cache_info().misses
    for _ in range(2):
        client.get(f"/tiku/t/{CODE}/")
        client.get("/tiku/y/2018/shuliang/")
    assert pages._render_topic.cache_info().misses == t_miss + 1
    assert pages._render_year.cache_info().misses == y_miss + 1


def test_lastmod_not_masked_by_legacy_iso_text_updated_at(client):
    """生产 50 个在架考点存在 ISO 文本 updated_at，MAX 取到文本后 sitemap lastmod 一直停在 2026-08-09。"""
    conn = db.get_conn()
    # 哨兵年份 1899：共享测试库含真实题库导入数据，常规年份行数不可断言
    _seed(conn, "文本时间戳题：早期导入", updated_at=TEXT_TS, tag3="SL-JH-01", year=1899)
    _seed(conn, "数值时间戳题：后来隔离", updated_at=time.time(), tag3="SL-JH-01", year=1899)
    conn.close()
    _reset_ttl_caches()
    today = time.strftime("%Y-%m-%d", time.gmtime())
    lastmod = db.tag3_lastmod()["SL-JH-01"]
    assert isinstance(lastmod, float) and time.strftime("%Y-%m-%d", time.gmtime(lastmod)) == today
    n, mu = db.year_module_counts()[(1899, "shuliang")]
    assert n == 2 and isinstance(mu, float) and time.strftime("%Y-%m-%d", time.gmtime(mu)) == today
    sm = client.get("/sitemap-topics.xml").text
    assert f"/tiku/t/SL-JH-01/</loc><lastmod>{today}</lastmod>" in sm
    assert "<lastmod>2026-08-09</lastmod>" not in sm.split("SL-JH-01")[1][:60]


def test_legacy_iso_text_alone_still_yields_its_own_date(client):
    from app import taxonomy

    _reset_ttl_caches()
    counts = db.tag3_counts()
    code = next(c for c, t in taxonomy.topic_index().items() if t["module"] == "shuliang" and not counts.get(c))
    conn = db.get_conn()
    _seed(conn, "只有文本时间戳的考点题", updated_at=TEXT_TS, tag3=code, year=2014)
    conn.close()
    _reset_ttl_caches()
    lastmod = db.tag3_lastmod()[code]
    assert time.strftime("%Y-%m-%d", time.gmtime(lastmod)) == "2026-08-09"
    assert f"/tiku/t/{code}/</loc><lastmod>2026-08-09</lastmod>" in client.get("/sitemap-topics.xml").text
