from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship
from backend.models.base import Base, TimestampMixin, gen_uuid


class Stem(Base, TimestampMixin):
    __tablename__ = "stems"

    id = Column(String, primary_key=True, default=gen_uuid)
    stem_type = Column(String, nullable=False)  # vocals, drums, bass, melodic, other
    file_path = Column(String, nullable=False)
    source = Column(String, nullable=True)  # "upload", "separated", "generated"
    song_id = Column(String, ForeignKey("songs.id"), nullable=False)

    song = relationship("Song", back_populates="stems")
