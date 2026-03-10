from sqlalchemy import Column, Integer, String, TIMESTAMP

from shared.database import Base


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True)
    # Cross-service references stored as plain integers (no ORM-level FK)
    player1_id = Column(Integer, nullable=False)
    player2_id = Column(Integer, nullable=False)
    winner_id = Column(Integer, nullable=True)
    score_p1 = Column(Integer, default=0)
    score_p2 = Column(Integer, default=0)
    started_at = Column(TIMESTAMP)
    finished_at = Column(TIMESTAMP, nullable=True)
    status = Column(String(20))
