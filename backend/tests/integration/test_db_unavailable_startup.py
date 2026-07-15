import pytest
from sqlalchemy import create_engine

from app.db.base import check_database_connection


def test_unreachable_database_raises_a_clear_error() -> None:
    # Port 1 is (practically) guaranteed to refuse the connection outright,
    # so this never depends on a real service being absent/present.
    bad_engine = create_engine(
        "postgresql+psycopg://baduser:badpass@localhost:1/nonexistent", future=True
    )

    with pytest.raises(RuntimeError, match="unreachable"):
        check_database_connection(bad_engine)


def test_reachable_database_does_not_raise() -> None:
    from app.db.base import engine

    check_database_connection(engine)
