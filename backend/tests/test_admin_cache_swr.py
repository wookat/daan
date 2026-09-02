"""_cached stale-while-revalidate 语义回归。"""

import threading
import time

from app import db


def _reset(key: str):
    with db._admin_cache_lock:
        db._ADMIN_CACHE.pop(key, None)
        db._admin_refreshing.discard(key)


def test_cold_miss_computes_sync():
    _reset("t_cold")
    assert db._cached("t_cold", 60, lambda: "v1") == "v1"
    assert db._ADMIN_CACHE["t_cold"][1] == "v1"


def test_fresh_hit_skips_fn():
    _reset("t_fresh")
    db._cached("t_fresh", 60, lambda: "v1")

    def boom():
        raise AssertionError("fn should not run on fresh hit")

    assert db._cached("t_fresh", 60, boom) == "v1"


def test_stale_returns_old_and_refreshes_in_background():
    _reset("t_stale")
    db._cached("t_stale", 60, lambda: "old")
    with db._admin_cache_lock:
        db._ADMIN_CACHE["t_stale"] = (time.time() - 120, "old")
    started = threading.Event()
    release = threading.Event()

    def slow_new():
        started.set()
        release.wait(5)
        return "new"

    assert db._cached("t_stale", 60, slow_new) == "old"  # 不阻塞，先回旧值
    assert started.wait(5)
    # 重算进行中：再次过期访问仍回旧值且不重复起线程（单飞）
    assert db._cached("t_stale", 60, slow_new) == "old"
    release.set()
    for _ in range(100):
        with db._admin_cache_lock:
            if db._ADMIN_CACHE["t_stale"][1] == "new":
                break
        time.sleep(0.05)
    assert db._cached("t_stale", 60, lambda: "x") == "new"


def test_startup_prime_fills_admin_caches():
    """R229/R230：启动预热后 stats/dashboard/governance 进缓存，首个管理员请求不再同步冷构建。"""
    from app import main

    for key in ("stats", "dashboard", "governance"):
        _reset(key)
    main._prime_admin_caches()
    with db._admin_cache_lock:
        assert "stats" in db._ADMIN_CACHE
        assert "dashboard" in db._ADMIN_CACHE
        assert "governance" in db._ADMIN_CACHE

    def boom():
        raise AssertionError("primed key should hit cache")

    assert db._cached("stats", 300, boom) is db._ADMIN_CACHE["stats"][1]
    assert db._cached("dashboard", 300, boom) is db._ADMIN_CACHE["dashboard"][1]
    assert db._cached("governance", 600, boom) is db._ADMIN_CACHE["governance"][1]


def test_cached_state_transitions():
    """R238：_cached_state 外显命中态 cold→hit→stale。"""
    _reset("t_state")
    assert db._cached_state("t_state", 60, lambda: "v1") == ("v1", "cold")
    assert db._cached_state("t_state", 60, lambda: "v2") == ("v1", "hit")
    with db._admin_cache_lock:
        db._ADMIN_CACHE["t_state"] = (time.time() - 120, "v1")
    val, state = db._cached_state("t_state", 60, lambda: "v3")
    assert (val, state) == ("v1", "stale")


def test_admin_endpoints_expose_cache_state_header(client, monkeypatch):
    """R238：stats/dashboard/governance 响应带 X-Kg-Cache 头（origin 日志逐请求取证）。"""
    from app import deps

    monkeypatch.setattr(deps, "ADMIN_TOKEN", "t0ken")
    for path, key in (
        ("/api/admin/stats", "stats"),
        ("/api/admin/dashboard", "dashboard"),
        ("/api/admin/governance", "governance"),
    ):
        _reset(key)
        r = client.get(path, headers={"X-Admin-Token": "t0ken"})
        assert r.status_code == 200
        assert r.headers["X-Kg-Cache"] == "cold"
        r2 = client.get(path, headers={"X-Admin-Token": "t0ken"})
        assert r2.headers["X-Kg-Cache"] == "hit"
        with db._admin_cache_lock:
            ts, data = db._ADMIN_CACHE[key]
            db._ADMIN_CACHE[key] = (ts - 3600, data)
        r3 = client.get(path, headers={"X-Admin-Token": "t0ken"})
        assert r3.headers["X-Kg-Cache"] == "stale"


def test_refresh_failure_keeps_old_value():
    _reset("t_fail")
    db._cached("t_fail", 60, lambda: "old")
    with db._admin_cache_lock:
        db._ADMIN_CACHE["t_fail"] = (time.time() - 120, "old")

    def boom():
        raise RuntimeError("refresh failed")

    assert db._cached("t_fail", 60, boom) == "old"
    for _ in range(100):
        with db._admin_cache_lock:
            if "t_fail" not in db._admin_refreshing:
                break
        time.sleep(0.05)
    with db._admin_cache_lock:
        assert db._ADMIN_CACHE["t_fail"][1] == "old"
        assert "t_fail" not in db._admin_refreshing
