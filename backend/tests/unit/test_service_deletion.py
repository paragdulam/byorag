from pathlib import Path

import pytest

from app.sources.service import delete_documents


def test_delete_documents_removes_real_file(tmp_path: Path) -> None:
    (tmp_path / "report.pdf").write_bytes(b"contents")

    results = delete_documents(["report.pdf"], pdfs_dir=tmp_path)

    assert [r.model_dump() for r in results] == [
        {"id": "report.pdf", "status": "deleted", "reason": None}
    ]
    assert not (tmp_path / "report.pdf").exists()


def test_delete_documents_already_absent_is_deleted_not_failed(tmp_path: Path) -> None:
    results = delete_documents(["missing.pdf"], pdfs_dir=tmp_path)

    assert results[0].status == "deleted"
    assert results[0].reason is None


def test_delete_documents_os_error_is_reported_as_failed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / "locked.pdf").write_bytes(b"contents")

    def raise_permission_error(self: Path) -> None:
        raise PermissionError("Permission denied")

    monkeypatch.setattr(Path, "unlink", raise_permission_error)

    results = delete_documents(["locked.pdf"], pdfs_dir=tmp_path)

    assert results[0].id == "locked.pdf"
    assert results[0].status == "failed"
    assert results[0].reason is not None
    assert (tmp_path / "locked.pdf").exists()


def test_delete_documents_mixed_batch_reports_independent_outcomes_in_order(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / "real.pdf").write_bytes(b"contents")
    (tmp_path / "locked.pdf").write_bytes(b"contents")

    original_unlink = Path.unlink

    def selective_unlink(self: Path, *args: object, **kwargs: object) -> None:
        if self.name == "locked.pdf":
            raise PermissionError("Permission denied")
        return original_unlink(self, *args, **kwargs)

    monkeypatch.setattr(Path, "unlink", selective_unlink)

    results = delete_documents(
        ["real.pdf", "already-absent.pdf", "locked.pdf"], pdfs_dir=tmp_path
    )

    assert [r.id for r in results] == ["real.pdf", "already-absent.pdf", "locked.pdf"]
    assert [r.status for r in results] == ["deleted", "deleted", "failed"]
    assert results[2].reason is not None
    assert not (tmp_path / "real.pdf").exists()
    assert (tmp_path / "locked.pdf").exists()


@pytest.mark.parametrize(
    "unsafe_id",
    [
        "../escape.pdf",
        "../../etc/passwd",
        "sub/dir.pdf",
        "sub\\dir.pdf",
        "",
    ],
)
def test_delete_documents_rejects_unsafe_ids_without_touching_filesystem(
    tmp_path: Path, unsafe_id: str
) -> None:
    sibling = tmp_path.parent / "escape.pdf"
    sibling.write_bytes(b"must not be touched")
    try:
        results = delete_documents([unsafe_id], pdfs_dir=tmp_path)

        assert [r.model_dump() for r in results] == [
            {"id": unsafe_id, "status": "failed", "reason": "invalid id"}
        ]
        assert sibling.exists()
    finally:
        sibling.unlink(missing_ok=True)
