from sqlalchemy import Column, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.models.base import Base, TimestampMixin, gen_uuid


class Persona(Base, TimestampMixin):
    __tablename__ = "personas"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    voice_sample_path = Column(String, nullable=True)
    embedding_path = Column(String, nullable=True)
    style_mode = Column(String, nullable=True, default="rap")  # rap, melodic, rnb
    # Provenance — which engine owns this persona's voice
    # "xtts" (default — uses voice_sample_path) or "elevenlabs" (uses elevenlabs_voice_id)
    voice_engine = Column(String, nullable=True, default="xtts")
    elevenlabs_voice_id = Column(String, nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)

    user = relationship("User", back_populates="personas")
