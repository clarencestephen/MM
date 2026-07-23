"""Idempotent local-first schema sync.

Runs at every startup. Two phases:

1. ``Base.metadata.create_all`` — adds any newly-defined tables.
2. Column drift sweep — for each table, compare the live columns against
   the model's columns and ``ALTER TABLE ... ADD COLUMN`` for any that are
   missing. Logs what it changes.

Limitations (intentional — local-first, no migration history kept):
- Does not drop columns.
- Does not rename columns or change types.
- For columns declared NOT NULL without a server-side default, the column
  is added as NULLABLE instead (SQLite cannot retroactively enforce NOT NULL
  on rows that already exist). A warning is logged so it surfaces.

For schema changes more complex than additions, write a one-off SQL script.
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import inspect, text
from sqlalchemy.schema import CreateColumn

from backend.database import engine
from backend.models import Base

log = logging.getLogger("migrate")


def _compile_column_ddl(table_name: str, column) -> str:
    """Render `<name> <type> [NULL|NOT NULL] [DEFAULT ...]` for ALTER TABLE."""
    dialect = engine.dialect
    has_default = column.server_default is not None or column.default is not None

    # SQLite cannot add a NOT NULL column to a populated table without a default.
    # Force nullable in that case and log a warning — better than crashing.
    relax_nullable = (
        not column.nullable
        and column.server_default is None
        and dialect.name == "sqlite"
    )
    if relax_nullable:
        log.warning(
            "Column %s.%s is NOT NULL with no server_default; adding as NULLABLE "
            "for compatibility with existing rows.",
            table_name, column.name,
        )

    ddl = CreateColumn(column).compile(dialect=dialect).string
    if relax_nullable:
        # CreateColumn renders NOT NULL when nullable=False; strip it for ALTER.
        ddl = ddl.replace(" NOT NULL", "")
    return ddl


def sync_schema() -> None:
    log.info("Creating any missing tables...")
    Base.metadata.create_all(bind=engine)

    insp = inspect(engine)
    live_tables = set(insp.get_table_names())

    additions = 0
    with engine.begin() as conn:
        for table_name, table in Base.metadata.tables.items():
            if table_name not in live_tables:
                continue  # create_all just made it; columns are correct

            live_cols = {c["name"] for c in insp.get_columns(table_name)}
            for column in table.columns:
                if column.name in live_cols:
                    continue
                ddl = _compile_column_ddl(table_name, column)
                stmt = f'ALTER TABLE "{table_name}" ADD COLUMN {ddl}'
                log.info("Adding column: %s.%s", table_name, column.name)
                conn.execute(text(stmt))
                additions += 1

    if additions:
        log.info("Schema sync complete — added %d column(s).", additions)
    else:
        log.info("Schema sync complete — no changes.")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    sync_schema()


if __name__ == "__main__":
    main()
