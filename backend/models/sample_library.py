from sqlalchemy import Column, String, Integer, Float, Boolean
from backend.models.base import Base, TimestampMixin, gen_uuid


class SamplePack(Base, TimestampMixin):
    __tablename__ = "sample_packs"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # drums, bass, melody, vocals, fx, loops
    icon = Column(String, nullable=False, default="music")  # lucide icon name
    color = Column(String, nullable=False, default="#8b5cf6")
    description = Column(String, nullable=True)
    file_path = Column(String, nullable=True)  # path to audio file
    duration_seconds = Column(Float, nullable=True)
    bpm = Column(Integer, nullable=True)
    key = Column(String, nullable=True)
    tags = Column(String, nullable=True)  # comma-separated: "dark,trap,808"
    is_free = Column(Boolean, nullable=False, default=True)  # available on free tier
    sort_order = Column(Integer, nullable=False, default=0)
