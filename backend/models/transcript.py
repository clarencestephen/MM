from sqlalchemy import Column, String, ForeignKey, Text, JSON
from backend.models.base import Base, TimestampMixin, gen_uuid


class Transcript(Base, TimestampMixin):
    __tablename__ = "transcripts"

    id = Column(String, primary_key=True, default=gen_uuid)
    song_id = Column(String, ForeignKey("songs.id"), nullable=False)
    word_timestamps = Column(JSON, nullable=True)  # [{word, start, end}, ...]
    full_text = Column(Text, nullable=True)
    source = Column(String, nullable=True)  # "whisper", "forced_alignment", "user"
