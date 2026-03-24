from sqlalchemy import Column, ForeignKey, Integer, String, TIMESTAMP, Boolean
from sqlalchemy.sql import func

from shared.database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String(50), unique=True, nullable=False)
    credential_id = Column(Integer, ForeignKey("credentials.id"), unique=True, nullable=True)
    password_hash = Column(String)
    status       = Column(String(20), default="offline")
    avatar_url   = Column(String, nullable=True)
    display_name = Column(String(50), nullable=True)
    created_at   = Column(TIMESTAMP, default=func.now())
    bio          = Column(String, nullable=True)
    dark_mode    = Column(Boolean, server_default='false', nullable=False)
