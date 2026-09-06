"""R219：运维审计日志解析（parse_ops_status）三态回归。"""
from datetime import datetime, timedelta, timezone

from app.ops_status import parse_ops_status

CST = timezone(timedelta(hours=8))


def _write(dirpath, name, lines):
    (dirpath / name).write_text("\n".join(lines) + "\n", encoding="utf-8")


def _now_cst(delta_h=0):
    return (datetime.now(CST) - timedelta(hours=delta_h)).strftime("%Y-%m-%d %H:%M:%S")


def _now_utc(delta_h=0):
    return (datetime.now(timezone.utc) - timedelta(hours=delta_h)).strftime("%Y-%m-%dT%H:%M:%SZ")


def test_missing_dir_returns_unavailable(tmp_path):
    assert parse_ops_status(str(tmp_path / "nope")) == {"available": False}


def test_parse_all_ok(tmp_path):
    _write(tmp_path, "kaogong-ops.log", [
        f"{_now_cst(2)} r2 upload ok data-2026-09-02.db.gz (154461785 bytes)",
        f"{_now_cst(2)} RESTORE-VERIFY ok questions=156792",
        f"{_now_cst(2)} R2-VERIFY ok md5 match data-2026-09-02.db.gz",
        f"{_now_cst(1)} MEM mem_avail=489MiB swap_used=2137MiB uvicorn_rss=5160kB",
        f"{_now_cst(1)} OK api=200 backup done",
    ])
    _write(tmp_path, "deploy-history.log", [
        f"{_now_utc(3)} rev=8eb6334 bundle=index-A.js by=devin-box",
        f"{_now_utc(1)} rev=94d28e2 bundle=index-B.js by=devin-box",
    ])
    _write(tmp_path, "container-events.log", [
        f"{_now_utc(30)} CHANGE prev=[a] cur=[b] mem_avail=304MiB",
        f"{_now_utc(2)} CHANGE prev=[b] cur=[c] mem_avail=398MiB",
    ])
    out = parse_ops_status(str(tmp_path))
    assert out["available"] is True
    assert out["last_deploy"]["rev"] == "94d28e2"
    assert out["backup"]["ok"] and out["backup"]["detail"].startswith("ok")
    assert out["restore_verify"]["ok"] and "questions=156792" in out["restore_verify"]["detail"]
    assert out["r2_verify"]["ok"]
    assert "mem_avail=489MiB" in out["mem"]["detail"]
    assert out["container_changes_24h"] == 1  # 30h 前那条不计入
    assert out["last_container_change"]["line"].endswith("mem_avail=398MiB")
    assert out["alerts"] == []


def test_failed_lines_marked_and_alerted(tmp_path):
    _write(tmp_path, "kaogong-ops.log", [
        f"{_now_cst(200)} RESTORE-VERIFY FAILED gunzip-failed",  # 超 7 天，不进 alerts
        f"{_now_cst(3)} r2 upload FAILED data-2026-09-02.db.gz",
        f"{_now_cst(2)} RESTORE-VERIFY FAILED verify-script-failed: boom",
        f"{_now_cst(1)} DISK HIGH 93% used on /",
        f"{_now_cst(1)} UNHEALTHY api=000, restarting",
        f"{_now_cst(1)} VOLUME-SNAPSHOT 2 file(s) 340 MB: /data/a.db.gz /data/b.db.gz (move to r2:x/archive/)",
    ])
    out = parse_ops_status(str(tmp_path))
    assert out["available"] is True
    assert out["backup"]["ok"] is False
    assert out["restore_verify"]["ok"] is False
    assert out["r2_verify"] is None
    assert len(out["alerts"]) == 5  # 7 天窗口内的 5 条告警
    assert any("DISK HIGH" in a for a in out["alerts"])
    assert any("VOLUME-SNAPSHOT" in a for a in out["alerts"])


def test_garbage_lines_tolerated(tmp_path):
    _write(tmp_path, "kaogong-ops.log", [
        'time="2026-09-01T03:42:27+08:00" level=warning msg="The LLM_API_KEY variable is not set."',
        " Container deploy-kaogong-1 Running ",
        f"{_now_cst(1)} OK api=200 backup done",
    ])
    out = parse_ops_status(str(tmp_path))
    assert out["available"] is True
    assert out["restore_verify"] is None
    assert out["alerts"] == []
