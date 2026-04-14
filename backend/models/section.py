from sqlalchemy import Column, String, Integer, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from backend.models.base import Base, TimestampMixin, gen_uuid


class Section(Base, TimestampMixin):
    __tablename__ = "sections"

    id = Column(String, primary_key=True, default=gen_uuid)
    label = Column(String, nullable=False)  # intro, verse, hook, bridge, outro
    order_index = Column(Integer, nullable=False)
    lyrics = Column(Text, nullable=True)
    start_time = Column(Float, nullable=True)
    end_time = Column(Float, nullable=True)
    energy = Column(String, nullable=True)  # low, medium, high, climax
    song_id = Column(String, ForeignKey("songs.id"), nullable=False)

    song = relationship("Song", back_populates="sections")
