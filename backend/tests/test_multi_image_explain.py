"""多图识题回归：/api/explain 与 /api/explain/stream 支持最多 4 张图片。

- multipart 重复 'image' 字段（H5 多选/拖拽/粘贴）
- images_b64 JSON [{data,mime}]（小程序 uploadFile 单文件 + 其余走 base64）
- 超过 4 张截断、单张 >8MB 报 400、纯文字不变、单图旧行为兼容
"""
import base64
import json

from fastapi.testclient import TestClient

from app import ai_api, engine
from app.main import app

PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


def _fake_extract(captured):
    async def _extract(images, _mime=None, _text=None):
        captured["images"] = images
        captured["text"] = _text
        return {"question_text": "多图题干吗", "module": "yanyu", "question_type": "逻辑填空", "user_answer": None}

    return _extract


async def _explain(_ex, _ua):
    return "解析：选 A。"


def _client(monkeypatch, captured):
    monkeypatch.setattr(engine, "extract_question", _fake_extract(captured))
    monkeypatch.setattr(engine, "explain", _explain)
    monkeypatch.setattr(ai_api, "check_access", lambda *_a, **_k: None)
    monkeypatch.setattr(ai_api, "rl", lambda *_a, **_k: None)
    return TestClient(app)


def _files(n):
    return [("image", (f"q{i}.png", PNG, "image/png")) for i in range(n)]


def test_explain_accepts_multiple_images(monkeypatch):
    captured: dict = {}
    with _client(monkeypatch, captured) as c:
        r = c.post("/api/explain", files=_files(3), data={"user_answer": "B"})
    assert r.status_code == 200, r.text
    imgs = captured["images"]
    assert len(imgs) == 3
    assert all(m == "image/png" for _b, m in imgs)
    assert all(base64.b64decode(b) == PNG for b, _m in imgs)
    assert r.json()["explanation"] == "解析：选 A。"


def test_explain_caps_at_four_images(monkeypatch):
    captured: dict = {}
    with _client(monkeypatch, captured) as c:
        r = c.post("/api/explain", files=_files(6))
    assert r.status_code == 200, r.text
    assert len(captured["images"]) == 4


def test_explain_rejects_oversized_image(monkeypatch):
    captured: dict = {}
    big = b"\x00" * (8 * 1024 * 1024 + 1)
    with _client(monkeypatch, captured) as c:
        r = c.post("/api/explain", files=[("image", ("big.png", big, "image/png"))])
    assert r.status_code == 400, r.text
    assert "过大" in r.json().get("detail", "")


def test_explain_images_b64_field(monkeypatch):
    """小程序路径：首图走文件字段，其余 images_b64 JSON 追加。"""
    captured: dict = {}
    extras = json.dumps(
        [{"data": base64.b64encode(PNG).decode(), "mime": "image/png"}] * 2
    )
    with _client(monkeypatch, captured) as c:
        r = c.post("/api/explain", files=_files(1), data={"images_b64": extras})
    assert r.status_code == 200, r.text
    assert len(captured["images"]) == 3


def test_explain_images_b64_only(monkeypatch):
    """全部走 images_b64（H5 重做无 File 对象的回退）。"""
    captured: dict = {}
    extras = json.dumps([{"data": base64.b64encode(PNG).decode(), "mime": "image/png"}])
    with _client(monkeypatch, captured) as c:
        r = c.post("/api/explain", data={"images_b64": extras})
    assert r.status_code == 200, r.text
    assert len(captured["images"]) == 1


def test_explain_text_only_unchanged(monkeypatch):
    captured: dict = {}
    with _client(monkeypatch, captured) as c:
        r = c.post("/api/explain", data={"text": "纯文字题干：以下说法正确的是？"})
    assert r.status_code == 200, r.text
    assert captured["images"] == []
    assert "纯文字" in captured["text"]


def test_stream_accepts_multiple_images(monkeypatch):
    captured: dict = {}

    async def _stream(_ex, _ua, with_thinking=False):
        yield "解析：流式选 A。"

    monkeypatch.setattr(engine, "extract_question", _fake_extract(captured))
    monkeypatch.setattr(engine, "explain_stream", _stream)
    monkeypatch.setattr(ai_api, "check_access", lambda *_a, **_k: None)
    monkeypatch.setattr(ai_api, "rl", lambda *_a, **_k: None)
    with TestClient(app) as c:
        r = c.post("/api/explain/stream", files=_files(2))
    assert r.status_code == 200, r.text
    assert len(captured["images"]) == 2
    assert "event: meta" in r.text
    assert "解析：流式选 A。" in r.text
