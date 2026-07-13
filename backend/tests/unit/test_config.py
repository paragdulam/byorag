from pathlib import Path

from app.config import ensure_pdfs_dir


def test_ensure_pdfs_dir_creates_missing_directory(tmp_path: Path) -> None:
    target = tmp_path / "does" / "not" / "exist"
    assert not target.exists()

    result = ensure_pdfs_dir(target)

    assert result == target
    assert target.is_dir()


def test_ensure_pdfs_dir_is_noop_when_already_exists(tmp_path: Path) -> None:
    target = tmp_path / "already"
    target.mkdir()

    ensure_pdfs_dir(target)
    ensure_pdfs_dir(target)

    assert target.is_dir()
