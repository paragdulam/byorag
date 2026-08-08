import logging
from pathlib import Path

from sqlalchemy import Engine, text

logger = logging.getLogger(__name__)


def ensure_schema_migrations(target_engine: Engine) -> None:
    """Idempotently brings pre-existing `corpora`/`documents` tables up to
    024-user-authentication's schema (research.md §2): adds `user_id` to both — as a
    plain column with no DB-level foreign-key constraint, since this codebase already
    enforces cross-field invariants like this at the service layer rather than the
    database (e.g. `ConversationTurn.scope`), and Postgres has no
    `ADD CONSTRAINT IF NOT EXISTS` to do it idempotently anyway — adds `content`
    (bytes) to `documents`, backfills it from each row's on-disk `storage_path` file
    (so existing documents' PDF content is never silently lost), and only then drops
    `storage_path`. Safe to call on every startup: every step is guarded so a second
    call is a no-op.
    """
    with target_engine.connect() as connection:
        connection.execute(text("ALTER TABLE corpora ADD COLUMN IF NOT EXISTS user_id UUID"))
        connection.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id UUID"))
        connection.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS content BYTEA"))
        connection.commit()

        # `corpora.name` predates this feature as globally unique; corpus names are now
        # scoped per user instead (data-model.md), so the old constraint must be replaced
        # with a composite one — `create_all` only creates missing tables, never adds
        # constraints to ones that already exist, so this has to happen here too.
        connection.execute(text("ALTER TABLE corpora DROP CONSTRAINT IF EXISTS corpora_name_key"))
        has_composite_constraint = connection.execute(
            text("SELECT 1 FROM pg_constraint WHERE conname = 'uq_corpus_user_name'")
        ).first()
        if has_composite_constraint is None:
            connection.execute(
                text(
                    "ALTER TABLE corpora ADD CONSTRAINT uq_corpus_user_name "
                    "UNIQUE (user_id, name)"
                )
            )
        connection.commit()

        # Same per-user-scoping story for `documents.content_hash` (research.md §7): dedup
        # is per user, not global, so two different users uploading identical bytes must
        # each get their own row.
        connection.execute(
            text("ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_content_hash_key")
        )
        has_document_composite_constraint = connection.execute(
            text("SELECT 1 FROM pg_constraint WHERE conname = 'uq_document_user_content_hash'")
        ).first()
        if has_document_composite_constraint is None:
            connection.execute(
                text(
                    "ALTER TABLE documents ADD CONSTRAINT uq_document_user_content_hash "
                    "UNIQUE (user_id, content_hash)"
                )
            )
        connection.commit()

        has_storage_path = connection.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = 'documents' AND column_name = 'storage_path'"
            )
        ).first()
        if has_storage_path is not None:
            rows = connection.execute(
                text("SELECT id, storage_path FROM documents WHERE content IS NULL")
            ).all()
            migrated = 0
            for row in rows:
                path = Path(row.storage_path)
                if not path.is_file():
                    logger.warning(
                        "Schema migration: document %s's file %s is missing; content left null",
                        row.id,
                        row.storage_path,
                    )
                    continue
                connection.execute(
                    text("UPDATE documents SET content = :content WHERE id = :id"),
                    {"content": path.read_bytes(), "id": row.id},
                )
                migrated += 1
            connection.commit()
            logger.info("Schema migration: backfilled content for %d document(s)", migrated)

            connection.execute(text("ALTER TABLE documents DROP COLUMN IF EXISTS storage_path"))
            connection.commit()

        # 033-ui-ux-polish (data-model.md): corpus<->document relationship changes from
        # many-to-many (`document_corpora`) to one-to-many (`documents.corpus_id`) — a
        # plain column with no DB-level FK/NOT NULL, same reasoning as `user_id` above;
        # "a corpus can't be deleted while it has documents" is enforced at the service
        # layer (`corpora/service.py`), now querying `documents.corpus_id` directly.
        connection.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS corpus_id UUID"))
        connection.commit()

        has_document_corpora = connection.execute(
            text("SELECT 1 FROM information_schema.tables WHERE table_name = 'document_corpora'")
        ).first()
        if has_document_corpora is not None:
            # Each document keeps its *earliest* corpus association as its sole owner
            # (research.md §1) — deterministic, no user interaction needed. Any other
            # associations it had are simply dropped along with the join table itself.
            connection.execute(
                text(
                    "UPDATE documents SET corpus_id = sub.corpus_id "
                    "FROM ("
                    "  SELECT DISTINCT ON (document_id) document_id, corpus_id "
                    "  FROM document_corpora "
                    "  ORDER BY document_id, added_at ASC, corpus_id ASC"
                    ") AS sub "
                    "WHERE documents.id = sub.document_id AND documents.corpus_id IS NULL"
                )
            )
            connection.execute(text("DROP TABLE document_corpora"))
            connection.commit()

        # Content-hash dedup moves from per-user to per-(user, corpus) — the same PDF can
        # now exist in two different corpora as two independent rows (spec.md
        # Clarifications), since there's no more shared reference to reuse across corpora.
        connection.execute(
            text("ALTER TABLE documents DROP CONSTRAINT IF EXISTS uq_document_user_content_hash")
        )
        has_document_corpus_hash_constraint = connection.execute(
            text(
                "SELECT 1 FROM pg_constraint WHERE conname = 'uq_document_user_corpus_content_hash'"
            )
        ).first()
        if has_document_corpus_hash_constraint is None:
            connection.execute(
                text(
                    "ALTER TABLE documents ADD CONSTRAINT uq_document_user_corpus_content_hash "
                    "UNIQUE (user_id, corpus_id, content_hash)"
                )
            )
        connection.commit()
