from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


@pytest.fixture
def pdfs_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    directory = tmp_path / "pdfs"
    monkeypatch.setattr(settings, "pdfs_dir", directory)
    return directory


@pytest.fixture
def client(pdfs_dir: Path) -> TestClient:
    return TestClient(app)
