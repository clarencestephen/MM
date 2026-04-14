from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.models.base import Base, TimestampMixin, gen_uuid


class Subscription(Base, TimestampMixin):
    __tablename__ = "subscriptions"

    id = Column(String, primary_key=True, default=gen_uuid)
    tier = Column(String, nullable=False, default="free")  # free, pro
    status = Column(String, nullable=False, default="active")  # active, canceled, past_due
    stripe_customer_id = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    current_period_end = Column(DateTime, nullable=True)

    user_id = Column(String, ForeignKey("users.id"), nullable=False, unique=True)

    user = relationship("User", backref="subscription")
