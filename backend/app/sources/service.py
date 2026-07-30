from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.hashing import compute_content_hash
from app.db.lookups import get_corpus_owned_by, get_document_owned_by
from app.db.models import Document, DocumentCorpus
from app.sources.schemas import (
    AllSourceDocument,
    DeletionResult,
    SourceDocument,
    UploadRejection,
    UploadRejectionReason,
)

MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024
ACCEPTED_EXTENSION = ".pdf"
ACCEPTED_CONTENT_TYPE = "application/pdf"


class DocumentNotFoundError(Exception):
    def __init__(self, document_id: str) -> None:
        self.document_id = document_id
        super().__init__(f"No document found with id '{document_id}'")


class CorpusNotFoundError(Exception):
    def __init__(self, corpus_id: str) -> None:
        self.corpus_id = corpus_id
        super().__init__(f"No corpus found with id '{corpus_id}'")


class DocumentNotInCorpusError(Exception):
    def __init__(self, document_id: str, corpus_id: str) -> None:
        self.document_id = document_id
        self.corpus_id = corpus_id
        super().__init__(f"Document '{document_id}' is not associated with corpus '{corpus_id}'")


def _document_to_source_document(document: Document) -> SourceDocument:
    return SourceDocument(
        id=document.id,
        name=document.name,
        sizeBytes=document.size_bytes,
        uploadedAt=document.uploaded_at,
        status=document.status,
    )


def list_all_documents(db: Session, user_id: str) -> list[AllSourceDocument]:
    """Every document owned by `user_id`, each annotated with every corpus it's
    currently associated with (009-corpora-screen, contracts/list-all-documents-api.md;
    scoped per user by 024-user-authentication). Unpaginated, consistent with this
    project's established small/personal scale assumption."""
    documents = (
        db.execute(
            select(Document)
            .where(Document.user_id == user_id)
            .order_by(Document.uploaded_at.asc())
        )
        .scalars()
        .all()
    )
    links = db.execute(
        select(DocumentCorpus).where(
            DocumentCorpus.document_id.in_([document.id for document in documents])
        )
    ).scalars().all()

    corpus_ids_by_document: dict[str, list[str]] = {}
    for link in links:
        corpus_ids_by_document.setdefault(link.document_id, []).append(link.corpus_id)

    return [
        AllSourceDocument(
            id=document.id,
            name=document.name,
            sizeBytes=document.size_bytes,
            uploadedAt=document.uploaded_at,
            status=document.status,
            corpusIds=corpus_ids_by_document.get(document.id, []),
        )
        for document in documents
    ]


def list_documents(db: Session, corpus_id: str) -> list[SourceDocument]:
    documents = (
        db.execute(
            select(Document)
            .join(DocumentCorpus, DocumentCorpus.document_id == Document.id)
            .where(DocumentCorpus.corpus_id == corpus_id)
            .order_by(Document.uploaded_at.asc())
        )
        .scalars()
        .all()
    )
    return [_document_to_source_document(document) for document in documents]


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


def _link_document_to_corpus(db: Session, document_id: str, corpus_id: str) -> None:
    """Idempotent: a document already linked to this corpus is a no-op (FR-006)."""
    existing_link = db.get(DocumentCorpus, {"document_id": document_id, "corpus_id": corpus_id})
    if existing_link is None:
        db.add(DocumentCorpus(document_id=document_id, corpus_id=corpus_id))
    db.commit()


def save_file(
    upload: UploadFile, db: Session, corpus_id: str, user_id: str
) -> SourceDocument | UploadRejection:
    contents = upload.file.read()

    rejection_reason = validate_file(upload.filename or "", len(contents), upload.content_type)
    if rejection_reason is not None:
        return UploadRejection(fileName=upload.filename or "", reason=rejection_reason)

    content_hash = compute_content_hash(contents)
    existing = db.execute(
        select(Document).where(
            Document.content_hash == content_hash, Document.user_id == user_id
        )
    ).scalar_one_or_none()
    if existing is not None:
        # Auto-dedupe by content (FR-005, research.md §3): reuse the existing
        # document and its chunks instead of writing a duplicate row or
        # re-running chunking. Scoped to this user's own documents — content
        # matching another user's document is a coincidence, not a dedupe target
        # (corpora/documents are strictly private, spec.md Clarifications).
        _link_document_to_corpus(db, existing.id, corpus_id)
        return _document_to_source_document(existing)

    existing_names = set(
        db.execute(select(Document.name).where(Document.user_id == user_id)).scalars().all()
    )
    target_name = resolve_collision_name(upload.filename or "", existing_names)

    document = Document(
        user_id=user_id,
        name=target_name,
        content_hash=content_hash,
        content=contents,
        size_bytes=len(contents),
        status="processed",
    )
    db.add(document)
    db.flush()
    db.add(DocumentCorpus(document_id=document.id, corpus_id=corpus_id))
    db.commit()
    db.refresh(document)
    return _document_to_source_document(document)


def attach_document_to_corpus(db: Session, user_id: str, document_id: str, corpus_id: str) -> None:
    """A document may only be attached to a corpus sharing its owner — since both lookups
    below already require `user_id` ownership, this is automatically satisfied (corpora and
    documents are strictly private, 024-user-authentication research.md §7)."""
    if get_document_owned_by(db, document_id, user_id) is None:
        raise DocumentNotFoundError(document_id)
    if get_corpus_owned_by(db, corpus_id, user_id) is None:
        raise CorpusNotFoundError(corpus_id)

    _link_document_to_corpus(db, document_id, corpus_id)


def unlink_document_from_corpus(db: Session, user_id: str, document_id: str, corpus_id: str) -> None:
    """Unlink a document from one corpus (FR-007). If this was the document's
    last remaining corpus, delete the document and its chunks (DB cascade) —
    its content lives entirely in this row, with nothing left over to
    separately clean up (024-user-authentication research.md §8)."""
    document = get_document_owned_by(db, document_id, user_id)
    if document is None:
        raise DocumentNotFoundError(document_id)
    if get_corpus_owned_by(db, corpus_id, user_id) is None:
        raise CorpusNotFoundError(corpus_id)

    link = db.get(DocumentCorpus, {"document_id": document_id, "corpus_id": corpus_id})
    if link is None:
        raise DocumentNotInCorpusError(document_id, corpus_id)

    db.delete(link)
    db.flush()

    remaining = db.execute(
        select(DocumentCorpus).where(DocumentCorpus.document_id == document_id)
    ).scalars().all()

    if remaining:
        db.commit()
        return

    db.delete(document)
    db.commit()


def get_document_content(db: Session, document_id: str) -> bytes:
    """Resolves a document's stored PDF bytes for the file-serving endpoint
    (021-sources-chunking-embeddings-refresh contracts/sources-file-api.md, updated by
    024-user-authentication research.md §8 to read from the database instead of a
    filesystem path). Ownership is asserted by the router before this is called; raises
    `DocumentNotFoundError` only for a truly unknown id."""
    document = db.get(Document, document_id)
    if document is None:
        raise DocumentNotFoundError(document_id)

    return document.content


def delete_documents(db: Session, user_id: str, ids: list[str]) -> list[DeletionResult]:
    results: list[DeletionResult] = []
    for document_id in ids:
        document = get_document_owned_by(db, document_id, user_id)
        if document is None:
            # Idempotent: the desired end state (no such document of yours) already
            # holds, matching 004-delete-source-documents' original semantics — also
            # covers a cross-account id, which must look identical to an unknown one
            # (FR-009).
            results.append(DeletionResult(id=document_id, status="deleted"))
            continue

        db.delete(document)
        db.commit()
        results.append(DeletionResult(id=document_id, status="deleted"))

    return results
