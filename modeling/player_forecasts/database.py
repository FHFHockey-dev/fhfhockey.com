from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover - reported when a database command is used
    psycopg = None
    dict_row = None


@contextmanager
def readonly_connection(database_url: str):
    if psycopg is None:
        raise RuntimeError("psycopg 3.2.1 is required for database commands")
    with psycopg.connect(database_url, row_factory=dict_row) as connection:
        connection.execute("set transaction read only")
        connection.execute("set statement_timeout = '120s'")
        yield connection
        connection.rollback()


def stream_query(connection: Any, name: str, query: str, parameters: tuple[Any, ...]) -> Iterator[dict[str, Any]]:
    with connection.cursor(name=name) as cursor:
        cursor.itersize = 2_000
        cursor.execute(query, parameters)
        for row in cursor:
            yield dict(row)
