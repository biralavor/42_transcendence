from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from service.history import get_match_history
from service.persistence import create_match, finish_match, get_leaderboard, get_match, get_user_matches, get_user_stats
from service.schemas import (
    LeaderboardEntryResponse,
    MatchCreateRequest,
    MatchFinishRequest,
    MatchHistoryItem,
    MatchResponse,
    StatsResponse,
)
from shared.database import get_db

router = APIRouter()

SessionDependency = Annotated[AsyncSession, Depends(get_db)]


@router.get("/stats/{user_id}", response_model=StatsResponse)
async def user_stats(user_id: int, session: SessionDependency):
    return await get_user_stats(session, user_id)


@router.get("/leaderboard", response_model=list[LeaderboardEntryResponse])
async def leaderboard(
    session: SessionDependency,
    # Use FastAPI's Query parameters to enforce bounds and document them.  This
    # replaces manual normalization and will return a 422 response if the
    # provided limit is out of range.  Defaults to 20, minimum 1, maximum 100.
    limit: int = Query(20, ge=1, le=100),
) -> list[LeaderboardEntryResponse]:
    return await get_leaderboard(session, limit)


@router.get("/matches/history/{user_id}", response_model=list[MatchHistoryItem])
async def match_history(user_id: int, session: SessionDependency):
    return await get_match_history(user_id, session)


@router.get("/matches/{user_id}", response_model=list[MatchResponse])
async def user_matches(user_id: int, session: SessionDependency):
    return await get_user_matches(session, user_id)


@router.post("/matches", status_code=status.HTTP_201_CREATED, response_model=MatchResponse)
async def start_match(body: MatchCreateRequest, session: SessionDependency):
    return await create_match(session, body.player1_id, body.player2_id)


@router.post("/matches/{match_id}/finish", response_model=MatchResponse)
async def end_match(match_id: int, body: MatchFinishRequest, session: SessionDependency):
    match = await get_match(session, match_id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    if match.status == "finished":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Match already finished")
    return await finish_match(session, match_id, body.winner_id, body.score_p1, body.score_p2)
