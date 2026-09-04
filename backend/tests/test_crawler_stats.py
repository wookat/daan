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


def _line(ts, ua, uri="/tiku/q/1", status=200, kg_ua=None, ip="66.249.66.1"):
    headers = {"User-Agent": [ua], "X-Kg-Ip": [ip]}
    if kg_ua is not None:
        headers["X-Kg-Ua"] = [kg_ua]
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
