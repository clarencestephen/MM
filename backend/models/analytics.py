from sqlalchemy import Column, String, Integer, Float, DateTime, Date
from backend.models.base import Base, TimestampMixin, gen_uuid


class DailyMetric(Base):
    __tablename__ = "daily_metrics"

    id = Column(String, primary_key=True, default=gen_uuid)
    date = Column(Date, nullable=False)
    metric_name = Column(String, nullable=False)  # signups, sessions_created, tracks_recorded, exports, conversions, active_users
    value = Column(Float, nullable=False, default=0)
    # For breakdowns
    dimension = Column(String, nullable=True)  # e.g., "tier:free", "format:mp3", "category:drums"


class EventLog(Base, TimestampMixin):
    __tablename__ = "event_logs"

    id = Column(String, primary_key=True, default=gen_uuid)
    event_type = Column(String, nullable=False)  # signup, login, session_create, track_record, track_convert, export, upgrade
    user_id = Column(String, nullable=True)
    metadata_json = Column(String, nullable=True)  # JSON string with event details
