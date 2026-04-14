from sqlalchemy import Column, String, Integer, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.models.base import Base, TimestampMixin, gen_uuid


class Song(Base, TimestampMixin):
    __tablename__ = "songs"

    id = Column(String, primary_key=True, default=gen_uuid)
    title = Column(String, nullable=False, default="Untitled")
    prompt = Column(Text, nullable=True)
    lyrics = Column(Text, nullable=True)
    genre = Column(String, nullable=True, default="hip_hop")
    mood = Column(String, nullable=True)
    bpm = Column(Integer, nullable=True)
    key = Column(String, nullable=True)
    status = Column(String, nullable=False, default="draft")
    beat_path = Column(String, nullable=True)
    vocal_path = Column(String, nullable=True)
    mix_path = Column(String, nullable=True)

    project_id = Column(String, ForeignKey("projects.id"), nullable=False)

    project = relationship("Project", back_populates="songs")
    versions = relationship("SongVersion", back_populates="song")
    sections = relationship("Section", back_populates="song")
    stems = relationship("Stem", back_populates="song")
    render_jobs = relationship("RenderJob", back_populates="song")
    export_jobs = relationship("ExportJob", back_populates="song")
