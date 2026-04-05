from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from service.auth import get_current_user_id
from service.history import get_match_history
from service.persistence import (
    NotTournamentCreator,
    TournamentFull,
    TournamentNotEnoughParticipants,
    TournamentNotFound,
    TournamentNotOpen,
    UserAlreadyRegistered,
    create_match,
    create_tournament,
    finish_match,
    get_leaderboard,
    get_match,
    get_tournament_with_participants,
    get_user_matches,
    get_user_stats,
    join_tournament,
    start_tournament,
)
from service.schemas import (
    LeaderboardEntryResponse,
    MatchCreateRequest,
    MatchFinishRequest,
    MatchHistoryItem,
    MatchResponse,
    StatsResponse,
    TournamentCreateRequest,
    TournamentCreateResponse,
    TournamentDetailResponse,
    TournamentMatchResponse,
    TournamentParticipantResponse,
)
from service.ws.router import manager as ws_manager
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


@router.post("/tournaments", status_code=status.HTTP_201_CREATED, response_model=TournamentCreateResponse)
async def create_tournament_endpoint(
    body: TournamentCreateRequest,
    session: SessionDependency,
    creator_id: int = Depends(get_current_user_id),
):
    tournament = await create_tournament(session, body.name, creator_id, body.max_participants)
    return TournamentCreateResponse(
        id=tournament.id,
        join_link=f"/api/game/tournaments/{tournament.id}/join",
    )


@router.get("/tournaments/{tournament_id}", response_model=TournamentDetailResponse)
async def get_tournament(tournament_id: int, session: SessionDependency):
    result = await get_tournament_with_participants(session, tournament_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
    tournament, participants, matches = result
    return TournamentDetailResponse(
        id=tournament.id,
        name=tournament.name,
        creator_id=tournament.creator_id,
        max_participants=tournament.max_participants,
        status=tournament.status,
        created_at=tournament.created_at,
        participants=[TournamentParticipantResponse(user_id=p.user_id, joined_at=p.joined_at) for p in participants],
        matches=[TournamentMatchResponse.model_validate(m) for m in matches],
    )


@router.post("/tournaments/{tournament_id}/join", status_code=status.HTTP_201_CREATED)
async def join_tournament_endpoint(
    tournament_id: int,
    session: SessionDependency,
    user_id: int = Depends(get_current_user_id),
):
    try:
        await join_tournament(session, tournament_id, user_id)
    except TournamentNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
    except TournamentNotOpen:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tournament already started")
    except UserAlreadyRegistered:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already registered")
    except TournamentFull:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tournament is full")
    return {"detail": "Joined successfully"}


@router.post("/tournaments/{tournament_id}/start", response_model=TournamentDetailResponse)
async def start_tournament_endpoint(
    tournament_id: int,
    session: SessionDependency,
    user_id: int = Depends(get_current_user_id),
):
    try:
        tournament, matches = await start_tournament(session, tournament_id, user_id)
    except TournamentNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
    except TournamentNotOpen:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tournament already started")
    except NotTournamentCreator:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creator can start the tournament")
    except TournamentNotEnoughParticipants:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tournament is not full yet")

    result = await get_tournament_with_participants(session, tournament_id)
    tournament, participants, _ = result

    response = TournamentDetailResponse(
        id=tournament.id,
        name=tournament.name,
        creator_id=tournament.creator_id,
        max_participants=tournament.max_participants,
        status=tournament.status,
        created_at=tournament.created_at,
        participants=[TournamentParticipantResponse(user_id=p.user_id, joined_at=p.joined_at) for p in participants],
        matches=[TournamentMatchResponse.model_validate(m) for m in matches],
    )

    await ws_manager.broadcast(
        f"tournament_{tournament_id}",
        {"type": "tournament_updated", "tournament_id": tournament_id},
    )

    return response


@router.post("/matches/{match_id}/finish", response_model=MatchResponse)
async def end_match(match_id: int, body: MatchFinishRequest, session: SessionDependency):
    match = await get_match(session, match_id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    if match.status == "finished":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Match already finished")
    if body.winner_id not in (match.player1_id, match.player2_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="winner_id must be one of the match players")
    return await finish_match(session, match_id, body.winner_id, body.score_p1, body.score_p2)
