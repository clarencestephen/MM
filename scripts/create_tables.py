"""Create all database tables. Run this once to initialize the DB."""
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.database import engine
from backend.models import Base


def main():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Done. All tables created.")


if __name__ == "__main__":
    main()
