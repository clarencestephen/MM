from sqlalchemy import Column, String, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from backend.models.base import Base, TimestampMixin, gen_uuid


class StudioSession(Base, TimestampMixin):
    __tablename__ = "studio_sessions"

    id = Column(String, primary_key=True, default=gen_uuid)
    title = Column(String, nullable=False, default="Untitled Session")
    bpm = Column(Integer, nullable=False, default=120)
    key = Column(String, nullable=False, default="C")
    scale = Column(String, nullable=False, default="major")
    time_signature = Column(String, nullable=False, default="4/4")
    status = Column(String, nullable=False, default="draft")  # draft, mixing, exported
    master_mix_path = Column(String, nullable=True)
    genre = Column(String, nullable=True, default="hip_hop")

    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    song_id = Column(String, ForeignKey("songs.id"), nullable=True)

    project = relationship("Project")
    song = relationship("Song")
    tracks = relationship("StudioTrack", back_populates="session", order_by="StudioTrack.order_index")
    arrangement_sections = relationship("ArrangementSection", back_populates="session", order_by="ArrangementSection.order_index")
