from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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


class TournamentMatchResultRequest(BaseModel):
    winner_id: int
    score_p1: int = 0
    score_p2: int = 0


class MatchHistoryItem(BaseModel):
    id: int
    opponent_id: int
    result: str   # "Win" | "Loss"
    score: str    # e.g. "11-3" (user score first, ASCII hyphen)
    date: str     # finished_at ISO string, "" if null


class TournamentCreateRequest(BaseModel):
    name: str
    max_participants: int = Field(ge=4, le=8)


class TournamentCreateResponse(BaseModel):
    id: int
    join_link: str


class TournamentParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    joined_at: datetime


class TournamentMatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tournament_id: int
    match_id: int | None
    round: int
    position: int
    player1_id: int | None
    player2_id: int | None
    winner_id: int | None
    status: str
    score_p1: int = 0
    score_p2: int = 0


class TournamentDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    creator_id: int
    max_participants: int
    status: str
    created_at: datetime
    participants: list[TournamentParticipantResponse]
    matches: list[TournamentMatchResponse] = []


# Leaderboard
class PlayerStats(BaseModel):
    rank: int
    wins: int
    losses: int
    points: int
    user_id: int
    max_streak: int
    total_games: int
    display_name: str
    goals_scored: int
    current_streak: int
    goals_conceded: int
    goal_difference: int


class StatEntry(BaseModel):
    value: int
    display_name: str


class Summary(BaseModel):
    max_points: StatEntry
    max_max_streak: StatEntry
    max_current_streak: StatEntry


class LeaderboardResponse(BaseModel):
    page: int
    last_page: int
    per_page: int
    total: int
    results: list[PlayerStats]
    summary: Summary


# AI Game
class AiGameRequest(BaseModel):
    difficulty: Literal["easy", "medium", "hard"] = "medium"


class AiGameResponse(BaseModel):
    game_id: str
