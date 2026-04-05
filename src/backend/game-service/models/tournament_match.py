from sqlalchemy import Column, ForeignKey, Integer, String, text

from shared.database import Base


class TournamentMatch(Base):
    __tablename__ = "tournament_matches"

    id = Column(Integer, primary_key=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=False)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=True)
    round = Column(Integer, nullable=False)
    position = Column(Integer, nullable=False)
    player1_id = Column(Integer, nullable=True)
    player2_id = Column(Integer, nullable=True)
    winner_id = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False, server_default=text("'pending'"))
