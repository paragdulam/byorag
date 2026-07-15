from collections.abc import Iterator

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection(target_engine: Engine) -> None:
    """Fail loudly (not silently) when the database is unreachable (spec User Story 3,
    Acceptance Scenario 2)."""
    try:
        with target_engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except OperationalError as exc:
        raise RuntimeError(
            f"Cannot start: database at {target_engine.url!r} is unreachable"
        ) from exc
