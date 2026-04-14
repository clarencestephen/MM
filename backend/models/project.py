from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship
from backend.models.base import Base, TimestampMixin, gen_uuid


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=gen_uuid)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)

    user = relationship("User", back_populates="projects")
    songs = relationship("Song", back_populates="project")
