from sqlalchemy import Column, Integer, String, TIMESTAMP
from sqlalchemy.sql import func

from shared.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True)
    password_hash = Column(String)
    status = Column(String(20), default="offline")
    created_at = Column(TIMESTAMP, default=func.now())
