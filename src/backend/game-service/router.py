from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from service.auth import get_current_user_id
from service.history import get_match_history
from service.persistence import (
    InvalidWinner,
    NotTournamentCreator,
    TournamentFull,
    TournamentMatchAlreadyFinished,
    TournamentMatchNotFound,
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
    list_tournaments,
    UserAlreadyInActiveTournament,
    record_tournament_match_result,
    start_tournament,
    TournamentCannotBeCancelled,
    delete_tournament,
    TournamentNotParticipant,
    leave_tournament,
)
from service.schemas import (
    LeaderboardEntryResponse,
    MatchCreateRequest,
    MatchFinishRequest,
    MatchHistoryItem,
    MatchResponse,
    TournamentMatchResultRequest,
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
    try:
        tournament = await create_tournament(session, body.name, creator_id, body.max_participants)
    except UserAlreadyInActiveTournament:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already participates in an active tournament",
        )

    return TournamentCreateResponse(
        id=tournament.id,
        join_link=f"/api/game/tournaments/{tournament.id}/join",
    )

@router.get("/tournaments", response_model=list[TournamentDetailResponse])
async def get_tournaments(session: SessionDependency):
    tournaments = await list_tournaments(session)
    response = []

    for tournament in tournaments:
        result = await get_tournament_with_participants(session, tournament.id)
        if result is None:
            continue

        tournament, participants, matches = result
        response.append(
            TournamentDetailResponse(
                id=tournament.id,
                name=tournament.name,
                creator_id=tournament.creator_id,
                max_participants=tournament.max_participants,
                status=tournament.status,
                created_at=tournament.created_at,
                participants=[
                    TournamentParticipantResponse(user_id=p.user_id, joined_at=p.joined_at)
                    for p in participants
                ],
                matches=[TournamentMatchResponse.model_validate(m) for m in matches],
            )
        )

    return response

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

@router.post("/tournaments/{tournament_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_tournament_endpoint(
    tournament_id: int,
    session: SessionDependency,
    user_id: int = Depends(get_current_user_id),
):
    try:
        await leave_tournament(session, tournament_id, user_id)
    except TournamentNotFound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tournament not found",
        )
    except TournamentNotOpen:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only open tournaments can be left",
        )
    except TournamentNotParticipant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a participant in this tournament",
        )

@router.delete("/tournaments/{tournament_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tournament_endpoint(
    tournament_id: int,
    session: SessionDependency,
    user_id: int = Depends(get_current_user_id),
):
    try:
        await delete_tournament(session, tournament_id, user_id)
    except TournamentNotFound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tournament not found",
        )
    except NotTournamentCreator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can cancel the tournament",
        )
    except TournamentCannotBeCancelled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only open tournaments can be cancelled",
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
    except UserAlreadyInActiveTournament:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already participates in another active tournament",
        )
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


@router.post(
    "/tournaments/{tournament_id}/matches/{match_id}/result",
    response_model=TournamentDetailResponse,
)
async def record_tournament_match_result_endpoint(
    tournament_id: int,
    match_id: int,
    body: TournamentMatchResultRequest,
    session: SessionDependency,
    user_id: int = Depends(get_current_user_id),
):
    try:
        _, tournament_complete = await record_tournament_match_result(
            session, tournament_id, match_id, body.winner_id, body.score_p1, body.score_p2
        )
    except TournamentNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
    except TournamentMatchNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found in this tournament")
    except TournamentMatchAlreadyFinished:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Match already finished")
    except InvalidWinner:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="winner_id must be one of the match players")

    await ws_manager.broadcast(
        f"tournament_{tournament_id}",
        {"type": "tournament_updated", "tournament_id": tournament_id},
    )
    if tournament_complete:
        await ws_manager.broadcast(
            f"tournament_{tournament_id}",
            {"type": "tournament_complete", "tournament_id": tournament_id},
        )

    result = await get_tournament_with_participants(session, tournament_id)
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
