from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    player1_id: int
    player2_id: int
    winner_id: int | None
    score_p1: int
    score_p2: int
    status: str
    started_at: datetime | None
    finished_at: datetime | None


class StatsResponse(BaseModel):
    user_id: int
    wins: int
    losses: int
    total_games: int
    goals_scored: int
    goals_conceded: int


class MatchCreateRequest(BaseModel):
    player1_id: int
    player2_id: int


class MatchFinishRequest(BaseModel):
    winner_id: int
    score_p1: int
    score_p2: int
