from sqlalchemy import Column, String, Boolean
from sqlalchemy.orm import relationship
from backend.models.base import Base, TimestampMixin, gen_uuid


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False)
    display_name = Column(String, nullable=True)
    password_hash = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    projects = relationship("Project", back_populates="user")
    personas = relationship("Persona", back_populates="user")
