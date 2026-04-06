from sqlalchemy import Column, Integer, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func

from shared.database import Base


class TournamentParticipant(Base):
    __tablename__ = "tournament_participants"

    tournament_id = Column(Integer, ForeignKey("tournaments.id"), primary_key=True)
    # Cross-service reference stored as plain integer (no ORM-level FK)
    user_id = Column(Integer, primary_key=True)
    joined_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
