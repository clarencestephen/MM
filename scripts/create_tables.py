"""DEPRECATED — kept as a shim. Use scripts/migrate.py instead.

migrate.py is a superset: it creates missing tables AND adds missing columns.
"""
from scripts.migrate import sync_schema


def main() -> None:
    print("Note: create_tables.py is deprecated. Run scripts/migrate.py going forward.")
    sync_schema()


if __name__ == "__main__":
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent))
    main()
