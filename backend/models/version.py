from sqlalchemy import Column, String, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.models.base import Base, TimestampMixin, gen_uuid


class SongVersion(Base, TimestampMixin):
    __tablename__ = "song_versions"

    id = Column(String, primary_key=True, default=gen_uuid)
    version_number = Column(Integer, nullable=False, default=1)
    change_description = Column(Text, nullable=True)
    beat_path = Column(String, nullable=True)
    vocal_path = Column(String, nullable=True)
    mix_path = Column(String, nullable=True)
    lyrics_snapshot = Column(Text, nullable=True)
    parent_version_id = Column(String, ForeignKey("song_versions.id"), nullable=True)
    song_id = Column(String, ForeignKey("songs.id"), nullable=False)

    song = relationship("Song", back_populates="versions")
