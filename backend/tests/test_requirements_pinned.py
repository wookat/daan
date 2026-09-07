"""R435：生产镜像依赖钉版源锁——Dockerfile 只装 requirements.txt，且每行都是 `==` 精确版本。"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _pins():
    lines = [ln.strip() for ln in (ROOT / "backend" / "requirements.txt").read_text().splitlines()]
    return [ln for ln in lines if ln and not ln.startswith("#")]


def test_every_requirement_is_exactly_pinned():
    pins = _pins()
    assert pins
    for ln in pins:
        assert re.fullmatch(r"[A-Za-z0-9_.\-\[\]]+==[0-9][0-9A-Za-z.\-]*", ln), ln


def test_runtime_deps_covered_by_pins():
    names = {ln.split("==")[0].lower().replace("_", "-") for ln in _pins()}
    for pkg in ["fastapi", "uvicorn", "httpx", "python-multipart", "reportlab", "pypdf",
                "opencv-python-headless", "numpy", "pypinyin", "pyjwt", "cryptography", "pywebpush"]:
        assert pkg in names, pkg


def test_dockerfiles_install_only_from_requirements():
    for df in [ROOT / "Dockerfile", ROOT / "deploy" / "Dockerfile.runtime"]:
        text = df.read_text()
        assert "pip install --no-cache-dir -r backend/requirements.txt" in text, df
        assert "COPY backend/requirements.txt backend/requirements.txt" in text, df
        for ln in text.splitlines():
            if "pip install" in ln:
                assert "-r backend/requirements.txt" in ln, ln
