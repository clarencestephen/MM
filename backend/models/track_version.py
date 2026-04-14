from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from backend.models.base import Base, TimestampMixin, gen_uuid


class TrackVersion(Base, TimestampMixin):
    __tablename__ = "track_versions"

    id = Column(String, primary_key=True, default=gen_uuid)
    version_number = Column(Integer, nullable=False, default=1)
    audio_path = Column(String, nullable=False)
    description = Column(String, nullable=True)

    track_id = Column(String, ForeignKey("studio_tracks.id"), nullable=False)

    track = relationship("StudioTrack", back_populates="versions")
