"""运维审计日志解析：把 VPS 侧三条审计日志（ops/部署/容器生命周期）汇总为管理台可读结构。

日志由 deploy/kaogong-ops.sh、deploy_h5.sh、kaogong-lifecycle-watch.sh 落盘到
/home/ubuntu/kaogong-reports（容器内只读挂载为 /reports），本模块只读解析、缺失容忍。
"""
import json
import os
import re
import time
from datetime import datetime, timedelta, timezone

TAIL_BYTES = 64 * 1024
ALERT_PAT = re.compile(r"FAILED|DISK HIGH|UNHEALTHY|SIZE MISMATCH")
CST = timezone(timedelta(hours=8))
# 看板固定置顶的引擎（无论有没有来过都列出，「从未」才看得见）
CRAWLER_PINNED = ("Google", "Baidu", "Bing")
CRAWLER_WINDOW_DAYS = 7


def _tail_lines(path: str) -> list[str]:
    try:
        with open(path, "rb") as f:
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - TAIL_BYTES))
            data = f.read()
    except OSError:
        return []
    lines = data.decode("utf-8", "replace").splitlines()
    # 截断起点可能落在行中间，丢弃首个残行
    return lines[1:] if len(lines) > 1 and TAIL_BYTES < os.path.getsize(path) else lines


def _ops_ts(line: str) -> float | None:
    # kaogong-ops.log 行首为北京时间 "2026-09-02 00:28:58"
    try:
        return datetime.strptime(line[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=CST).timestamp()
    except ValueError:
        return None


def _iso_ts(line: str) -> float | None:
    # deploy-history / container-events 行首为 UTC ISO "2026-09-01T16:57:37Z"
    try:
        return datetime.strptime(line.split(" ", 1)[0], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()
    except ValueError:
        return None


def _latest(lines: list[str], marker: str) -> dict | None:
    for line in reversed(lines):
        rest = line[20:] if _ops_ts(line) is not None else line
        if rest.startswith(marker):
            return {"ts": line[:19], "ok": not ALERT_PAT.search(line), "detail": rest[len(marker):].strip()[:160]}
    return None


def parse_crawler_stats(path: str, now: float | None = None) -> dict | None:
    """scripts/crawler_stats.py 落盘的 JSON → 近 7 天各引擎汇总；文件缺失/损坏返回 None。"""
    now = now or time.time()
    try:
        with open(path, encoding="utf-8") as f:
            raw = json.load(f)
    except (OSError, ValueError):
        return None
    if not isinstance(raw, dict) or not isinstance(raw.get("engines"), dict):
        return None
    days = [d for d in raw.get("days") or [] if isinstance(d, str)][-CRAWLER_WINDOW_DAYS:]
    today = days[-1] if days else None
    engines = raw["engines"]

    def _sum(e: dict, key: str) -> int:
        m = e.get(key) or {}
        return sum(int(m.get(d) or 0) for d in days)

    rows = []
    for name in list(CRAWLER_PINNED) + sorted(
        (n for n in engines if n not in CRAWLER_PINNED),
        key=lambda n: -_sum(engines[n], "hits"),
    ):
        e = engines.get(name) or {}
        last = e.get("last_seen")
        rows.append({
            "name": name,
            "hits_7d": _sum(e, "hits"),
            "hits_today": int((e.get("hits") or {}).get(today) or 0) if today else 0,
            "err5xx_7d": _sum(e, "err5xx"),
            "tiku_7d": _sum(e, "tiku"),
            "sitemap_7d": _sum(e, "sitemap"),
            "last_seen": (
                datetime.fromtimestamp(last, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                if isinstance(last, (int, float)) else None
            ),
        })
    hum = raw.get("humans") if isinstance(raw.get("humans"), dict) else {}
    humans = {
        "api_7d": _sum(hum, "api"),
        "api_today": int((hum.get("api") or {}).get(today) or 0) if today else 0,
        "api5xx_7d": _sum(hum, "api5xx"),
        "page_7d": _sum(hum, "page"),
        "ips_7d": _sum(hum, "ips"),
        "ips_today": int((hum.get("ips") or {}).get(today) or 0) if today else 0,
    } if hum else None
    gen = raw.get("generated_at")
    return {
        "generated_at": (
            datetime.fromtimestamp(gen, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            if isinstance(gen, (int, float)) else None
        ),
        "stale": not isinstance(gen, (int, float)) or gen < now - 3 * 3600,
        "window_days": len(days),
        "engines": rows,
        "humans": humans,
    }


def parse_ops_status(reports_dir: str, now: float | None = None) -> dict:
    now = now or time.time()
    ops = _tail_lines(os.path.join(reports_dir, "kaogong-ops.log"))
    deploys = _tail_lines(os.path.join(reports_dir, "deploy-history.log"))
    events = _tail_lines(os.path.join(reports_dir, "container-events.log"))
    if not ops and not deploys and not events:
        return {"available": False}
    crawlers = parse_crawler_stats(os.path.join(reports_dir, "crawler-stats.json"), now)

    last_deploy = None
    for line in reversed(deploys):
        m = re.match(r"(\S+) rev=(\S+) bundle=(\S+)", line)
        if m:
            last_deploy = {"ts": m.group(1), "rev": m.group(2), "bundle": m.group(3)}
            break

    changes_24h = 0
    last_change = None
    for line in reversed(events):
        if " CHANGE " not in line:
            continue
        ts = _iso_ts(line)
        if last_change is None:
            last_change = {"ts": line.split(" ", 1)[0], "line": line[:220]}
        if ts is not None and ts > now - 86400:
            changes_24h += 1

    alerts = []
    for line in reversed(ops):
        ts = _ops_ts(line)
        if ts is not None and ts > now - 7 * 86400 and ALERT_PAT.search(line):
            alerts.append(line[:200])
            if len(alerts) >= 20:
                break

    return {
        "available": True,
        "last_deploy": last_deploy,
        "backup": _latest(ops, "r2 upload"),
        "restore_verify": _latest(ops, "RESTORE-VERIFY"),
        "r2_verify": _latest(ops, "R2-VERIFY"),
        "mem": _latest(ops, "MEM"),
        "container_changes_24h": changes_24h,
        "last_container_change": last_change,
        "alerts": alerts,
        "crawlers": crawlers,
    }
