from sqlalchemy import Column, String, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from backend.models.base import Base, TimestampMixin, gen_uuid


class RenderJob(Base, TimestampMixin):
    __tablename__ = "render_jobs"

    id = Column(String, primary_key=True, default=gen_uuid)
    job_type = Column(String, nullable=False)  # vocal_gen, beat_gen, mix, separation
    status = Column(String, nullable=False, default="pending")  # pending, running, done, failed
    params = Column(JSON, nullable=True)
    result_path = Column(String, nullable=True)
    error = Column(Text, nullable=True)
    celery_task_id = Column(String, nullable=True)
    song_id = Column(String, ForeignKey("songs.id"), nullable=False)

    song = relationship("Song", back_populates="render_jobs")


class ExportJob(Base, TimestampMixin):
    __tablename__ = "export_jobs"

    id = Column(String, primary_key=True, default=gen_uuid)
    format = Column(String, nullable=False, default="wav")  # wav, mp3, stems_zip
    status = Column(String, nullable=False, default="pending")
    result_path = Column(String, nullable=True)
    error = Column(Text, nullable=True)
    song_id = Column(String, ForeignKey("songs.id"), nullable=False)

    song = relationship("Song", back_populates="export_jobs")
