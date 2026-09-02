"""SEO 包路由注册顺序契约：具体路径页族必须先于 /{module} 兜底路由匹配。

app/seo/__init__.py 依赖子模块导入顺序产生的路由注册副作用（shenlun→pages→catchall），
若被按字母序重排或合并，具体页族会被 catch-all 吞掉变成 404/错误渲染。
"""
from urllib.parse import quote

from app import db
from app.seo import catchall, router, shenlun

from .conftest import seed_questions
from .test_shenlun_hub import _seed_shenlun


def test_catchall_routes_registered_last():
    catchall_paths = {r.path for r in router.routes if r.endpoint.__module__ == catchall.__name__}
    assert catchall_paths, "catch-all 路由缺失"
    idx = {r.path: i for i, r in enumerate(router.routes)}
    max_specific = max(i for p, i in idx.items() if p not in catchall_paths)
    min_catchall = min(idx[p] for p in catchall_paths)
    assert min_catchall > max_specific, "兜底路由必须在全部具体路由之后注册"


def test_shenlun_specific_paths_not_swallowed_by_catchall(client):
    """/tiku/shenlun/、题型页、套卷页应命中申论页族路由而非模块兜底 404。"""
    seed_questions()
    _seed_shenlun()
    shenlun_paths = {r.path for r in router.routes if r.endpoint.__module__ == shenlun.__name__}
    assert "/tiku/shenlun/p/{paper}/" in shenlun_paths

    r = client.get("/tiku/shenlun/")
    assert r.status_code == 200 and "申论" in r.text

    r = client.get(f"/tiku/shenlun/p/{quote('2023年国考申论（副省级）')}/")
    assert r.status_code == 200 and "给定资料" in r.text

    r = client.get("/tiku/y/2023/shenlun/")
    assert r.status_code == 200

    conn = db.get_conn()
    qtype = conn.execute(
        "SELECT qtype FROM shenlun_questions WHERE disabled=0 LIMIT 1"
    ).fetchone()["qtype"]
    conn.close()
    r = client.get(f"/tiku/shenlun/{quote(qtype)}/")
    assert r.status_code == 200

    r = client.get("/tiku/nonexist-module/")
    assert r.status_code == 404
