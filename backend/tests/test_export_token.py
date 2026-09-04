"""W3-A：/api/questions/export 与 import 同一导入令牌门禁，匿名不可整库拉取题干/答案/解析。"""
from app import deps

from .conftest import seed_questions


def test_export_without_token_401(client, monkeypatch):
    monkeypatch.setattr(deps, "IMPORT_TOKEN", "test-import-token")
    r = client.get("/api/questions/export?limit=1")
    assert r.status_code == 401
    assert "items" not in r.json()


def test_export_wrong_token_401(client, monkeypatch):
    monkeypatch.setattr(deps, "IMPORT_TOKEN", "test-import-token")
    r = client.get("/api/questions/export?limit=1", headers={"X-Import-Token": "nope"})
    assert r.status_code == 401


def test_export_unconfigured_token_401(client, monkeypatch):
    monkeypatch.setattr(deps, "IMPORT_TOKEN", "")
    r = client.get("/api/questions/export?limit=1", headers={"X-Import-Token": ""})
    assert r.status_code == 401


def test_export_with_token_200(client, monkeypatch):
    monkeypatch.setattr(deps, "IMPORT_TOKEN", "test-import-token")
    seed_questions()
    r = client.get("/api/questions/export?limit=2&all=1", headers={"X-Import-Token": "test-import-token"})
    assert r.status_code == 200
    items = r.json()["items"]
    assert 1 <= len(items) <= 2
    assert {"id", "module", "question", "options", "answer"} <= set(items[0])
