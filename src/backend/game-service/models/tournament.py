from sqlalchemy import Column, Integer, String, TIMESTAMP
from sqlalchemy.sql import func

from shared.database import Base


class Tournament(Base):
    __tablename__ = "tournaments"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    # Cross-service reference stored as plain integer (no ORM-level FK)
    creator_id = Column(Integer, nullable=False)
    max_participants = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, server_default='waiting')
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
