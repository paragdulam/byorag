from datetime import datetime, timezone
from pathlib import Path

from fastapi import UploadFile

from app.config import ensure_pdfs_dir, settings
from app.sources.schemas import (
    DeletionResult,
    SourceDocument,
    UploadRejection,
    UploadRejectionReason,
)

MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024
ACCEPTED_EXTENSION = ".pdf"
ACCEPTED_CONTENT_TYPE = "application/pdf"


def _stat_to_document(path: Path) -> SourceDocument:
    stat = path.stat()
    return SourceDocument(
        id=path.name,
        name=path.name,
        sizeBytes=stat.st_size,
        uploadedAt=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
        status="processed",
    )


def list_documents(pdfs_dir: Path | None = None) -> list[SourceDocument]:
    directory = pdfs_dir if pdfs_dir is not None else settings.pdfs_dir
    ensure_pdfs_dir(directory)

    documents = [
        _stat_to_document(path) for path in directory.iterdir() if path.is_file()
    ]
    documents.sort(key=lambda doc: doc.uploadedAt)
    return documents


def validate_file(
    filename: str, size: int, content_type: str | None
) -> UploadRejectionReason | None:
    is_pdf = filename.lower().endswith(ACCEPTED_EXTENSION) or content_type == ACCEPTED_CONTENT_TYPE
    if not is_pdf:
        return "invalid-type"
    if size > MAX_UPLOAD_SIZE_BYTES:
        return "too-large"
    return None


def resolve_collision_name(name: str, existing_names: set[str]) -> str:
    if name not in existing_names:
        return name

    stem, _, suffix = name.rpartition(".")
    if not stem:
        stem, suffix = name, ""
    extension = f".{suffix}" if suffix else ""

    counter = 1
    while True:
        candidate = f"{stem} ({counter}){extension}"
        if candidate not in existing_names:
            return candidate
        counter += 1


def save_file(upload: UploadFile, pdfs_dir: Path | None = None) -> SourceDocument | UploadRejection:
    directory = pdfs_dir if pdfs_dir is not None else settings.pdfs_dir
    ensure_pdfs_dir(directory)

    contents = upload.file.read()

    rejection_reason = validate_file(upload.filename or "", len(contents), upload.content_type)
    if rejection_reason is not None:
        return UploadRejection(fileName=upload.filename or "", reason=rejection_reason)

    existing_names = {p.name for p in directory.iterdir() if p.is_file()}
    target_name = resolve_collision_name(upload.filename or "", existing_names)
    target_path = directory / target_name

    try:
        target_path.write_bytes(contents)
    except OSError:
        if target_path.exists():
            target_path.unlink(missing_ok=True)
        return UploadRejection(fileName=upload.filename or "", reason="save-failed")

    return _stat_to_document(target_path)


def _is_safe_id(document_id: str, directory: Path) -> bool:
    if not document_id or "/" in document_id or "\\" in document_id:
        return False

    candidate = (directory / document_id).resolve()
    try:
        candidate.relative_to(directory.resolve())
    except ValueError:
        return False
    return True


def delete_documents(ids: list[str], pdfs_dir: Path | None = None) -> list[DeletionResult]:
    directory = pdfs_dir if pdfs_dir is not None else settings.pdfs_dir
    ensure_pdfs_dir(directory)

    results: list[DeletionResult] = []
    for document_id in ids:
        if not _is_safe_id(document_id, directory):
            results.append(DeletionResult(id=document_id, status="failed", reason="invalid id"))
            continue

        try:
            (directory / document_id).unlink()
        except FileNotFoundError:
            results.append(DeletionResult(id=document_id, status="deleted"))
        except OSError as exc:
            results.append(DeletionResult(id=document_id, status="failed", reason=str(exc)))
        else:
            results.append(DeletionResult(id=document_id, status="deleted"))

    return results
