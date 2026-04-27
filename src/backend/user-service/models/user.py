from sqlalchemy import Column, ForeignKey, Integer, String, TIMESTAMP, Boolean, JSON
from sqlalchemy.sql import func

from shared.database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String(50), unique=True, nullable=False)
    credential_id = Column(Integer, ForeignKey("credentials.id"), unique=True, nullable=False)
    status       = Column(String(20), default="offline")
    avatar_url   = Column(String, nullable=True)
    display_name = Column(String(50), nullable=True)
    created_at   = Column(TIMESTAMP, default=func.now())
    bio          = Column(String, nullable=True)
    dark_mode    = Column(Boolean, server_default='false', nullable=False)
    is_admin     = Column(Boolean, server_default='false', nullable=False)
    last_login_at = Column(TIMESTAMP, nullable=True)
    game_preferences = Column(JSON, nullable=True)   # {"theme": str, "ball_speed_multiplier": float}
