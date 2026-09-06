"""R377：搜索引擎爬虫抓取日报（scripts/crawler_stats.py）+ ops_status.crawlers 解析回归。"""
import importlib.util
import json
import os
import time

from app.ops_status import parse_crawler_stats, parse_ops_status

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "crawler_stats.py")
_spec = importlib.util.spec_from_file_location("crawler_stats", SCRIPT)
assert _spec and _spec.loader
cs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(cs)

NOW = 1788524000.0  # 2026-09-04 12:xx UTC
DAY = 86400


def _line(ts, ua, uri="/tiku/q/1", status=200, kg_ua=None, ip="66.249.66.1", extra=None):
    headers = {"User-Agent": [ua], "X-Kg-Ip": [ip]}
    if kg_ua is not None:
        headers["X-Kg-Ua"] = [kg_ua]
    for k, v in (extra or {}).items():
        headers[k] = [v]
    return json.dumps({
        "ts": ts,
        "status": status,
        "request": {"uri": uri, "headers": headers, "remote_ip": "104.23.160.1"},
    })


GOOGLE = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
BING = "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"
YANDEX = "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)"
HUMAN = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1"
CURL = "curl/8.5.0"


def test_aggregate_by_engine_and_day():
    lines = [
        _line(NOW - 60, GOOGLE, "/robots.txt"),
        _line(NOW - 50, GOOGLE, "/sitemap.xml"),
        _line(NOW - 40, GOOGLE, "/tiku/q/4640"),
        _line(NOW - DAY - 10, BING, "/tiku/yanyu?page=2", 503),
        _line(NOW - DAY - 5, BING, "/tiku/t/abc"),
        _line(NOW - 10, HUMAN),
        _line(NOW - 10, CURL, "/api/health"),
        _line(NOW - 10, HUMAN, kg_ua=YANDEX),  # Worker 透传的真实 UA 优先
        "not json",
        "",
    ]
    r = cs.aggregate(iter(lines), days=7, now=NOW)
    assert len(r["days"]) == 7 and r["days"][-1] == "2026-09-04"
    g = r["engines"]["Google"]
    assert g["hits"] == {"2026-09-04": 3}
    assert g["sitemap"] == {"2026-09-04": 2}
    assert g["tiku"] == {"2026-09-04": 1}
    assert g["err5xx"] == {}
    assert g["last_seen"] == NOW - 40
    b = r["engines"]["Bing"]
    assert b["hits"] == {"2026-09-03": 2}
    assert b["err5xx"] == {"2026-09-03": 1}
    assert b["tiku"] == {"2026-09-03": 2}
    assert r["engines"]["Yandex"]["hits"] == {"2026-09-04": 1}
    # 真人 / curl 不算引擎；Baidu 没来过就不出现
    assert set(r["engines"]) == {"Google", "Bing", "Yandex"}


def test_probe_spoofed_googlebot_excluded(tmp_path):
    """开发会话伪装 Googlebot UA 的 SSR 自测（探针网段）不能让 Google 显示为「来过」。"""
    ipf = tmp_path / "probe-ips.txt"
    ipf.write_text("# devin\n140.232.64.0/24  # probe\nbad-line\n")
    nets = cs.load_exclude_networks(str(ipf))
    assert len(nets) == 1
    lines = [
        _line(NOW - 60, GOOGLE, ip="140.232.64.5"),
        _line(NOW - 50, BING, ip="40.77.167.1"),
    ]
    r = cs.aggregate(iter(lines), days=7, now=NOW, exclude_nets=nets)
    assert "Google" not in r["engines"] and r["probe_excluded"] == 1
    assert r["engines"]["Bing"]["hits"] == {"2026-09-04": 1}
    assert cs.load_exclude_networks(str(tmp_path / "missing")) == []


def test_aggregate_out_of_window_keeps_last_seen_only():
    lines = [_line(NOW - 30 * DAY, GOOGLE)]
    r = cs.aggregate(iter(lines), days=7, now=NOW)
    g = r["engines"]["Google"]
    assert g["hits"] == {} and g["last_seen"] == NOW - 30 * DAY


def test_iter_archive_reads_only_window_files(tmp_path):
    (tmp_path / "access-20260904.jsonl").write_text(_line(NOW - 1, GOOGLE) + "\n")
    (tmp_path / "access-20260901.jsonl").write_text(_line(NOW - 3 * DAY, BING) + "\n")
    (tmp_path / "access-20260801.jsonl").write_text(_line(NOW - 34 * DAY, YANDEX) + "\n")
    (tmp_path / "other.txt").write_text("x\n")
    r = cs.aggregate(cs.iter_archive(str(tmp_path), days=7, now=NOW), days=7, now=NOW)
    assert set(r["engines"]) == {"Google", "Bing"}


def test_iter_archive_reads_gzipped_and_multi_member_files(tmp_path):
    import gzip

    (tmp_path / "access-20260904.jsonl").write_text(_line(NOW - 1, GOOGLE) + "\n")
    with gzip.open(tmp_path / "access-20260902.jsonl.gz", "wt") as f:
        f.write(_line(NOW - 2 * DAY, BING) + "\n")
    # cron 用 gzip -c >> 追加成多成员 gz：两段都要读到
    p = tmp_path / "access-20260901.jsonl.gz"
    p.write_bytes(gzip.compress((_line(NOW - 3 * DAY, YANDEX) + "\n").encode())
                  + gzip.compress((_line(NOW - 3 * DAY + 60, YANDEX) + "\n").encode()))
    with gzip.open(tmp_path / "access-20260801.jsonl.gz", "wt") as f:
        f.write(_line(NOW - 34 * DAY, GOOGLE) + "\n")
    r = cs.aggregate(cs.iter_archive(str(tmp_path), days=7, now=NOW), days=7, now=NOW)
    assert set(r["engines"]) == {"Google", "Bing", "Yandex"}
    assert sum(r["engines"]["Yandex"]["hits"].values()) == 2
    assert sum(r["engines"]["Google"]["hits"].values()) == 1


def test_parse_crawler_stats_pins_google_baidu_bing(tmp_path):
    p = tmp_path / "crawler-stats.json"
    now = time.time()
    days = [f"2026-09-{d:02d}" for d in range(1, 8)]
    p.write_text(json.dumps({
        "generated_at": now - 600,
        "days": days,
        "engines": {
            "Google": {"hits": {"2026-09-07": 3}, "err5xx": {}, "tiku": {}, "sitemap": {"2026-09-07": 2},
                       "last_seen": now - 700},
            "Yandex": {"hits": {"2026-09-06": 40, "2026-09-07": 6}, "err5xx": {"2026-09-06": 3},
                       "tiku": {"2026-09-06": 40}, "sitemap": {}, "last_seen": now - 800},
            "Bing": {"hits": {"2026-09-05": 11}, "err5xx": {}, "tiku": {"2026-09-05": 9}, "sitemap": {},
                     "last_seen": now - 2 * DAY},
        },
    }))
    c = parse_crawler_stats(str(p), now=now)
    assert c is not None and c["stale"] is False and c["window_days"] == 7
    names = [e["name"] for e in c["engines"]]
    assert names == ["Google", "Baidu", "Bing", "Yandex"]
    g, baidu, _bing, ya = c["engines"]
    assert g["hits_7d"] == 3 and g["hits_today"] == 3 and g["sitemap_7d"] == 2 and g["last_seen"]
    assert baidu["hits_7d"] == 0 and baidu["last_seen"] is None
    assert ya["hits_7d"] == 46 and ya["err5xx_7d"] == 3 and ya["tiku_7d"] == 40 and ya["hits_today"] == 6


def test_parse_crawler_stats_missing_or_stale(tmp_path):
    assert parse_crawler_stats(str(tmp_path / "nope.json")) is None
    bad = tmp_path / "bad.json"
    bad.write_text("{not json")
    assert parse_crawler_stats(str(bad)) is None
    old = tmp_path / "old.json"
    old.write_text(json.dumps({"generated_at": time.time() - 5 * 3600, "days": [], "engines": {}}))
    c = parse_crawler_stats(str(old))
    assert c is not None and c["stale"] is True and c["window_days"] == 0
    assert [e["name"] for e in c["engines"]] == ["Google", "Baidu", "Bing"]


def test_ops_status_carries_crawlers(tmp_path):
    (tmp_path / "deploy-history.log").write_text("2026-09-04T11:44:39Z rev=e4b322f bundle=index-A.js by=devin-box\n")
    assert parse_ops_status(str(tmp_path))["crawlers"] is None
    (tmp_path / "crawler-stats.json").write_text(json.dumps({
        "generated_at": time.time(), "days": ["2026-09-04"],
        "engines": {"Google": {"hits": {"2026-09-04": 1}, "last_seen": time.time()}},
    }))
    c = parse_ops_status(str(tmp_path))["crawlers"]
    assert c and c["engines"][0]["name"] == "Google" and c["engines"][0]["hits_7d"] == 1


MINIAPP = "Mozilla/5.0 (Linux; Android 13; MI 12) AppleWebKit/537.36 Chrome/116 Mobile Safari/537.36 MiniProgramEnv/android"


def test_humans_exclude_probe_bots_and_test_uid(tmp_path):
    """R382：真人口径 = 非探针网段 + 非引擎/通用 bot UA + 非 test-/probe uid；只计 /api 与 HTML 页族。"""
    ex = tmp_path / "probe.txt"
    ex.write_text("140.232.64.0/24\n")
    nets = cs.load_exclude_networks(str(ex))
    lines = [
        _line(NOW - 10, HUMAN, "/api/questions?module=yanyu&uid=u1", ip="39.158.40.85"),
        _line(NOW - 9, MINIAPP, "/api/papers", 503, ip="39.158.40.85"),
        _line(NOW - 8, HUMAN, "/tiku/q/4640", ip="1.2.3.4"),
        _line(NOW - 7, HUMAN, "/", ip="1.2.3.4"),
        _line(NOW - 6, HUMAN, "/assets/index-abc.js", ip="1.2.3.4"),  # 静态资源不计
        _line(NOW - 5, HUMAN, "/api/health", ip="1.2.3.4"),  # 心跳不计
        _line(NOW - 4, HUMAN, "/api/answer_log?uid=test-w1-mp", ip="1.2.3.4"),  # 测试 uid
        _line(NOW - 3, HUMAN, "/api/questions", 503, ip="140.232.64.4"),  # 探针网段
        _line(NOW - 2, CURL, "/api/questions", 503, ip="8.8.8.8"),  # 通用 bot
        _line(NOW - 1, GOOGLE, "/tiku/q/1", ip="66.249.66.1"),  # 引擎
        _line(NOW - DAY - 1, HUMAN, "/api/daily_set", ip="5.6.7.8"),
        _line(NOW - 30 * DAY, HUMAN, "/api/daily_set", ip="5.6.7.8"),  # 窗口外
    ]
    r = cs.aggregate(iter(lines), days=7, now=NOW, exclude_nets=nets)
    h = r["humans"]
    assert h["api"] == {"2026-09-04": 2, "2026-09-03": 1}
    assert h["api5xx"] == {"2026-09-04": 1}
    assert h["page"] == {"2026-09-04": 2}
    assert h["ips"] == {"2026-09-04": 2, "2026-09-03": 1}
    assert r["engines"]["Google"]["hits"] == {"2026-09-04": 1}
    assert r["probe_excluded"] == 0  # 探针只在引擎 UA 分支计数，真人分支静默剔除
    assert h["direct"] == {}


def _direct_line(ts, ua, uri="/", status=403, remote_ip="3.238.133.204"):
    """绕过 CF 直打源站主机名的请求：只有 User-Agent，无 X-Kg-Ip/Cf-Connecting-Ip，Caddy @noedge 回 403。"""
    return json.dumps({
        "ts": ts,
        "status": status,
        "request": {"uri": uri, "headers": {"User-Agent": [ua]}, "remote_ip": remote_ip},
    })


def test_humans_exclude_direct_to_origin_scanners():
    """R388：源站直连（浏览器 UA 但无边缘头）不进候选真人，单独计 direct；旧格式日志（无 headers）仍按空 UA 视为 bot 不计。"""
    win = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36"
    lines = [
        _direct_line(NOW - 30, win, "/", 403, "3.238.133.204"),
        _direct_line(NOW - 29, win, "/", 403, "3.238.133.205"),
        _direct_line(NOW - 28, HUMAN, "/tiku/", 403, "45.1.2.3"),
        _direct_line(NOW - 27, HUMAN, "/api/questions", 403, "45.1.2.3"),
        _direct_line(NOW - 26, CURL, "/", 403, "45.1.2.9"),  # 通用 bot：不计也不进 direct
        _line(NOW - 20, HUMAN, "/tiku/q/4640", ip="1.2.3.4"),  # 经边缘的真页面
        json.dumps({"ts": NOW - 10, "status": 200,
                    "request": {"uri": "/tiku/y/2024/", "remote_ip": "104.23.160.1"}}),  # 旧格式无 headers
    ]
    r = cs.aggregate(iter(lines), days=7, now=NOW)
    h = r["humans"]
    assert h["page"] == {"2026-09-04": 1}
    assert h["api"] == {}
    assert h["ips"] == {"2026-09-04": 1}  # 扫描器 IP 不进去重
    assert h["direct"] == {"2026-09-04": 4}


def test_google_inspection_tool_is_google_not_human():
    """R388：GSC「网址检查」渲染器 UA（无 Googlebot 字样）归 Google，不进候选真人。"""
    nexus = ("Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 "
             "(KHTML, like Gecko) Chrome/152.0.7977.64 Mobile Safari/537.36 (compatible; Google-InspectionTool/1.0)")
    lines = [
        _line(NOW - 5, nexus, "/tiku/", ip="66.249.73.237"),
        _line(NOW - 4, "Mozilla/5.0 (compatible; Google-InspectionTool/1.0)", "/tiku/", ip="66.249.73.237"),
    ]
    r = cs.aggregate(iter(lines), days=7, now=NOW)
    assert r["engines"]["Google"]["hits"] == {"2026-09-04": 2}
    assert r["engines"]["Google"]["tiku"] == {"2026-09-04": 2}
    assert r["humans"]["page"] == {}


def test_parse_crawler_stats_humans_summary(tmp_path):
    p = tmp_path / "crawler-stats.json"
    now = time.time()
    days = [f"2026-09-{d:02d}" for d in range(1, 8)]
    base = {"generated_at": now - 600, "days": days, "engines": {}}
    p.write_text(json.dumps(base))
    assert parse_crawler_stats(str(p), now=now)["humans"] is None  # 旧版 JSON 无 humans 段
    base["humans"] = {
        "api": {"2026-09-07": 17, "2026-09-06": 30, "2026-08-30": 999},
        "api5xx": {"2026-09-06": 2},
        "page": {"2026-09-07": 4},
        "ips": {"2026-09-07": 3, "2026-09-06": 5},
    }
    p.write_text(json.dumps(base))
    h = parse_crawler_stats(str(p), now=now)["humans"]
    assert h == {"api_7d": 47, "api_today": 17, "api5xx_7d": 2, "page_7d": 4, "ips_7d": 8, "ips_today": 3,
                 "direct_7d": 0, "offhost_7d": 0}  # R388/R393 前的 JSON 无 direct/offhost 段→ 0
    base["humans"]["direct"] = {"2026-09-07": 30, "2026-09-05": 3, "2026-08-30": 999}
    base["humans"]["offhost"] = {"2026-09-07": 5, "2026-09-01": 7, "2026-08-30": 999}
    p.write_text(json.dumps(base))
    h = parse_crawler_stats(str(p), now=now)["humans"]
    assert h["direct_7d"] == 33 and h["offhost_7d"] == 12


DEVIN_UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/137.0.0.0 Safari/537.36; Devin/1.0; +devin.ai")
SITE = {"X-Forwarded-Host": "kaogong.zalize.com"}
PREVIEW = {"X-Forwarded-Host": "kaogong-h5.pages.dev"}


def test_humans_exclude_devin_ua_explicit_probe_header_and_preview_host():
    """R393：Devin 自动化 UA / 校验工具 → 通用 bot；显式 X-Kg-Probe 静默剔除；非正式域名单计 offhost；
    三者都不依赖探针网段配置。"""
    lines = [
        _line(NOW - 30, DEVIN_UA, "/tiku/", ip="2001:4860:7:30e::c4", extra=SITE),  # Google 预取代理转发
        _line(NOW - 29, DEVIN_UA, "/api/notes?uid=u9", ip="140.232.64.4", extra=SITE),
        _line(NOW - 28, "Mozilla/5.0 (compatible; Schema-Markup-Validator; +https://validator.schema.org/)",
              "/tiku/q/234080", ip="74.125.213.41", extra=SITE),
        _line(NOW - 27, HUMAN, "/api/track", ip="150.109.230.174", extra={**SITE, "X-Kg-Probe": "1"}),
        _line(NOW - 26, HUMAN, "/api/track", ip="150.109.230.174", extra={**SITE, "X-Kg-Probe": "0"}),
        _line(NOW - 25, HUMAN, "/api/home_bundle?uid=u1", ip="1.2.3.4", extra=PREVIEW),
        _line(NOW - 24, HUMAN, "/tiku/q/1", ip="1.2.3.4", extra={"X-Forwarded-Host": "KaoGong.zalize.com"}),
        _line(NOW - 23, HUMAN, "/api/profile?uid=u2", ip="5.6.7.8"),  # 无 X-Forwarded-Host（非 Functions 路径）照计
        _line(NOW - DAY - 1, HUMAN, "/", ip="5.6.7.8", extra=PREVIEW),
    ]
    r = cs.aggregate(iter(lines), days=7, now=NOW)
    h = r["humans"]
    assert h["api"] == {"2026-09-04": 2}  # 带 X-Kg-Probe: 0 的 track + 无 host 头的 profile
    assert h["page"] == {"2026-09-04": 1}
    assert h["ips"] == {"2026-09-04": 3}
    assert h["offhost"] == {"2026-09-04": 1, "2026-09-03": 1}
    assert h["direct"] == {} and r["engines"] == {}
    # 正式域名可配：预览域名也纳入时不再计 offhost
    r2 = cs.aggregate(iter(lines), days=7, now=NOW, site_hosts=["kaogong.zalize.com", "kaogong-h5.pages.dev"])
    assert r2["humans"]["offhost"] == {} and r2["humans"]["api"] == {"2026-09-04": 3}


def test_bot_generic_covers_backend_probe_ua_markers():
    """R393：后端 probe_request 的自动化 UA 签名，日报/周报的 BOT_GENERIC 必须全部能认出（两份清单不漂移）。"""
    from app import auth

    for marker in auth.PROBE_UA_MARKERS:
        assert cs.is_generic_bot(f"Mozilla/5.0 {marker}1.0"), marker
    for real in (HUMAN, MINIAPP, "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36"):
        assert not cs.is_generic_bot(real)
