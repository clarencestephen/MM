"""Mark a user as Pro tier (dev / founder-account convenience).

Usage:
    python scripts/set_pro.py <user_id>          # upgrade to pro
    python scripts/set_pro.py <user_id> --free   # downgrade
"""
import sys
from sqlalchemy import select

from backend.database import SessionLocal
from backend.models.user import User
from backend.models.subscription import Subscription


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    user_id = sys.argv[1]
    tier = "free" if "--free" in sys.argv else "pro"

    db = SessionLocal()
    try:
        # Auto-create user if it doesn't exist (matches the wizard's "default-user" convenience)
        user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
        if not user:
            user = User(id=user_id, email=f"{user_id}@mm.local", display_name=user_id)
            db.add(user)
            db.flush()
            print(f"  created user {user_id}")

        sub = db.execute(select(Subscription).where(Subscription.user_id == user_id)).scalar_one_or_none()
        if sub:
            sub.tier = tier
            sub.status = "active"
            print(f"  updated subscription: {user_id} → {tier}")
        else:
            sub = Subscription(user_id=user_id, tier=tier, status="active")
            db.add(sub)
            print(f"  created subscription: {user_id} → {tier}")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
