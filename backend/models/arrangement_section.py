from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from backend.models.base import Base, TimestampMixin, gen_uuid


class ArrangementSection(Base, TimestampMixin):
    __tablename__ = "arrangement_sections"

    id = Column(String, primary_key=True, default=gen_uuid)
    label = Column(String, nullable=False)  # intro, verse_1, chorus, bridge, guitar_solo, outro
    order_index = Column(Integer, nullable=False, default=0)
    start_bar = Column(Integer, nullable=False, default=0)
    length_bars = Column(Integer, nullable=False, default=8)
    color = Column(String, nullable=False, default="#6366f1")

    session_id = Column(String, ForeignKey("studio_sessions.id"), nullable=False)

    session = relationship("StudioSession", back_populates="arrangement_sections")
