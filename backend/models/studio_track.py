from sqlalchemy import Column, String, Integer, Float, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.models.base import Base, TimestampMixin, gen_uuid


class StudioTrack(Base, TimestampMixin):
    __tablename__ = "studio_tracks"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False, default="Track 1")
    order_index = Column(Integer, nullable=False, default=0)
    track_type = Column(String, nullable=False, default="recording")  # recording, midi, import, generated
    instrument_label = Column(String, nullable=True)  # drums, electric guitar, jazz saxophone, etc.
    raw_audio_path = Column(String, nullable=True)
    processed_audio_path = Column(String, nullable=True)
    midi_data = Column(JSON, nullable=True)  # [{note, velocity, start, end}, ...]
    duration_seconds = Column(Float, nullable=True)

    # Mix controls
    volume = Column(Float, nullable=False, default=0.0)  # dB
    pan = Column(Float, nullable=False, default=0.0)  # -1.0 (L) to 1.0 (R)
    muted = Column(Boolean, nullable=False, default=False)
    solo = Column(Boolean, nullable=False, default=False)
    color = Column(String, nullable=False, default="#8b5cf6")

    # Sync adjustments
    pitch_shift_semitones = Column(Integer, nullable=False, default=0)
    tempo_stretch_ratio = Column(Float, nullable=False, default=1.0)
    detected_key = Column(String, nullable=True)
    detected_bpm = Column(Float, nullable=True)

    session_id = Column(String, ForeignKey("studio_sessions.id"), nullable=False)

    session = relationship("StudioSession", back_populates="tracks")
    versions = relationship("TrackVersion", back_populates="track", order_by="TrackVersion.version_number")
