from typing import Annotated
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from service.auth import get_current_user_id, get_player_id_or_me, get_current_token
from service.history import get_match_history_paginated

from service.notifications import send_tournament_notification

from service.persistence import (
    InvalidWinner,
    NotTournamentCreator,
    TournamentCannotBeCancelled,
    TournamentFull,
    TournamentMatchAlreadyFinished,
    TournamentMatchNotFound,
    TournamentNotEnoughParticipants,
    TournamentNotFound,
    TournamentNotInProgress,
    TournamentNotOpen,
    TournamentNotParticipant,
    UserAlreadyInActiveTournament,
    UserAlreadyRegistered,
    create_match,
    create_tournament,
    delete_tournament,
    finish_match,
    get_achievements_for_user,
    get_leaderboard,
    get_leaderboard_paginated,
    get_match,
    get_tournament_with_participants,
    get_user_matches,
    get_user_stats,
    get_xp_for_user,
    join_tournament,
    leave_tournament,
    list_tournaments,
    record_tournament_match_result,
    start_tournament,
    withdraw_tournament,
)
from service.schemas import (
    AchievementResponse,
    MatchCreateRequest,
    MatchFinishRequest,
    MatchHistoryItem,
    MatchHistoryPage,
    MatchResponse,
    StatsResponse,
    TournamentCreateRequest,
    TournamentCreateResponse,
    TournamentDetailResponse,
    TournamentMatchResponse,
    TournamentMatchResultRequest,
    TournamentParticipantResponse,
    LeaderboardResponse,
    XpResponse,
)
from service.ws.router import (
    manager as ws_manager,
    sync_tournament_ready_timeouts,
)
from shared.database import get_db
from shared.util.order import get_sort_assoc_from_order_query

router = APIRouter()

SessionDependency = Annotated[AsyncSession, Depends(get_db)]


def _build_tournament_detail(tournament, participants, matches) -> TournamentDetailResponse:
    return TournamentDetailResponse(
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


async def _notify_match_available(token: str, tournament_id: int, matches) -> None:
    for match in matches:
        if getattr(match, "status", None) != "in_progress":
            continue
        for player_id in (match.player1_id, match.player2_id):
            if player_id is None:
                continue
            await send_tournament_notification(
                token,
                player_id,
                "tournament_match_available",
                tournament_id,
            )


async def _notify_tournament_complete(token: str, tournament_id: int, participants) -> None:
    for participant in participants:
        await send_tournament_notification(
            token,
            participant.user_id,
            "tournament_complete",
            tournament_id,
        )


@router.get("/stats/{user_id}", response_model=StatsResponse)
async def user_stats(user_id: int, session: SessionDependency):
    return await get_user_stats(session, user_id)


@router.get(
    "/leaderboard",
    response_model=LeaderboardResponse,
    summary="Get the global leaderboard",
    description=(
        "Returns a paginated leaderboard. **`limit` is capped at 100** per request "
        "(use `page=N` to walk further). Results include `xp`, `level`, "
        "`avatar_url` per row. The `order` query string accepts comma-separated "
        "`col:dir` pairs (e.g. `xp:desc,points:desc,user_id:asc`). Allowed "
        "columns: `rank, display_name, user_id, points, total_games, wins, "
        "losses, goals_scored, goals_conceded, goal_difference, max_streak, "
        "current_streak, xp, level`. Unknown columns are silently dropped. "
        "When `order` is empty the default is `xp DESC, points DESC, "
        "goal_difference DESC, goals_scored DESC, user_id ASC`."
    ),
)
async def leaderboard(
    session: SessionDependency,
    limit: int = Query(
        20, ge=1, le=100,
        description="Rows per page. Hard-capped at 100; pass page=N to walk further.",
    ),
    page: int = Query(0, ge=0, description="Zero-based page index."),
    order: str = Query(
        '',
        description="Comma-separated `col:dir` pairs (e.g. `xp:desc,wins:desc`).",
    ),
    player_id: int | None = Query(None, ge=0)
):
    sort_assoc = get_sort_assoc_from_order_query(order)
    paginated_result = \
        await get_leaderboard_paginated(session, player_id, limit, page, sort_assoc)
    return paginated_result


@router.get("/matches/history", response_model=MatchHistoryPage)
async def match_history_search(
        session: SessionDependency,
        player_id: Annotated[int, Depends(get_player_id_or_me)],
        date_from: datetime | None = Query(
            None,
            description='Start datetime in ISO 8601 format'
        ),
        date_to: datetime | None = Query(
            None,
            description='End datetime in ISO 8601 format'
        ),
        result: str = Query('all', pattern='^(all|win|loss)$'),
        order: str = Query(
            '',
            description="colname:desc,othercol:asc"
        ),
        limit: int = Query(10, ge=1),
        page: int = Query(0, ge=0)
) -> MatchHistoryPage:
    if limit > 50:
        limit = 50
    sort_assoc = get_sort_assoc_from_order_query(order)
    search_for = {
        'player_id': player_id,
        'date_from': date_from,
        'date_to': date_to,
        'result': result,
        'limit': limit,
        'page': page,
    }
    return await get_match_history_paginated(
        search_for, sort_assoc, session
    )


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
        full_tournament, participants, matches = result
        response.append(_build_tournament_detail(full_tournament, participants, matches))

    return response


@router.get("/tournaments/{tournament_id}", response_model=TournamentDetailResponse)
async def get_tournament(tournament_id: int, session: SessionDependency):
    result = await get_tournament_with_participants(session, tournament_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
    tournament, participants, matches = result
    return _build_tournament_detail(tournament, participants, matches)


@router.post("/tournaments/{tournament_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_tournament_endpoint(
    tournament_id: int,
    session: SessionDependency,
    user_id: int = Depends(get_current_user_id),
):
    try:
        await leave_tournament(session, tournament_id, user_id)
    except TournamentNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
    except TournamentNotOpen:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only open tournaments can be left")
    except TournamentNotParticipant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User is not a participant in this tournament")

    await ws_manager.broadcast(
        f"tournament_{tournament_id}",
        {"type": "tournament_updated", "tournament_id": tournament_id},
    )


@router.post("/tournaments/{tournament_id}/withdraw", response_model=TournamentDetailResponse)
async def withdraw_tournament_endpoint(
    tournament_id: int,
    session: SessionDependency,
    user_id: int = Depends(get_current_user_id),
    token: str = Depends(get_current_token),
):
    try:
        _, tournament_complete, newly_assigned = await withdraw_tournament(session, tournament_id, user_id)
    except TournamentNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
    except TournamentNotInProgress:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only tournaments in progress can be withdrawn from")
    except TournamentNotParticipant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User is not a participant in this tournament")

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
    sync_tournament_ready_timeouts(tournament_id, matches)

    await _notify_match_available(token, tournament_id, newly_assigned)
    if tournament_complete:
        await _notify_tournament_complete(token, tournament_id, participants)

    return _build_tournament_detail(tournament, participants, matches)


@router.delete("/tournaments/{tournament_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tournament_endpoint(
    tournament_id: int,
    session: SessionDependency,
    user_id: int = Depends(get_current_user_id),
):
    try:
        await delete_tournament(session, tournament_id, user_id)
    except TournamentNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
    except NotTournamentCreator:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creator can cancel the tournament")
    except TournamentCannotBeCancelled:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only open tournaments can be cancelled")


@router.post("/tournaments/{tournament_id}/join", status_code=status.HTTP_201_CREATED)
async def join_tournament_endpoint(
    tournament_id: int,
    session: SessionDependency,
    user_id: int = Depends(get_current_user_id),
    token: str = Depends(get_current_token),
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

    result = await get_tournament_with_participants(session, tournament_id)
    await ws_manager.broadcast(
        f"tournament_{tournament_id}",
        {"type": "tournament_updated", "tournament_id": tournament_id},
    )

    if result is not None:
        tournament, participants, _ = result
        if tournament.status == "open" and len(participants) == tournament.max_participants:
            await send_tournament_notification(
                token,
                tournament.creator_id,
                "tournament_full",
                tournament.id,
            )
    return {"detail": "Joined successfully"}


@router.post("/tournaments/{tournament_id}/start", response_model=TournamentDetailResponse)
async def start_tournament_endpoint(
    tournament_id: int,
    session: SessionDependency,
    user_id: int = Depends(get_current_user_id),
    token: str = Depends(get_current_token),
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
    tournament, participants, current_matches = result
    sync_tournament_ready_timeouts(tournament_id, current_matches)

    await ws_manager.broadcast(
        f"tournament_{tournament_id}",
        {"type": "tournament_updated", "tournament_id": tournament_id},
    )

    await _notify_match_available(token, tournament_id, matches)

    return _build_tournament_detail(tournament, participants, current_matches)


@router.post("/tournaments/{tournament_id}/matches/{match_id}/result", response_model=TournamentDetailResponse)
async def record_tournament_match_result_endpoint(
    tournament_id: int,
    match_id: int,
    body: TournamentMatchResultRequest,
    session: SessionDependency,
    user_id: int = Depends(get_current_user_id),
    token: str = Depends(get_current_token),
):
    try:
        _, tournament_complete, newly_assigned = await record_tournament_match_result(
            session,
            tournament_id,
            match_id,
            body.winner_id,
            body.score_p1,
            body.score_p2,
            user_id=user_id,
        )
    except TournamentNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
    except TournamentMatchNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found in this tournament")
    except TournamentMatchAlreadyFinished:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Match already finished")
    except InvalidWinner:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="winner_id must be one of the match players")
    except TournamentNotParticipant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only match participants can submit tournament results")

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
    sync_tournament_ready_timeouts(tournament_id, matches)

    await _notify_match_available(token, tournament_id, newly_assigned)
    if tournament_complete:
        await _notify_tournament_complete(token, tournament_id, participants)

    return _build_tournament_detail(tournament, participants, matches)


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


@router.get("/achievements/{user_id}", response_model=list[AchievementResponse])
async def user_achievements(user_id: int, session: SessionDependency):
    return await get_achievements_for_user(user_id, session)


@router.get("/xp/{user_id}", response_model=XpResponse)
async def user_xp(user_id: int, session: SessionDependency):
    data = await get_xp_for_user(user_id, session)
    if data is None:
        return XpResponse(user_id=user_id, xp=0, level=1, xp_in_level=0, xp_to_next_level=100)
    return XpResponse(**data)


@router.get("/xp-leaderboard", response_model=list[dict])
async def xp_leaderboard(session: SessionDependency, limit: int = Query(20, ge=1, le=100)):
    from sqlalchemy import text as _text
    result = await session.execute(
        _text("""
            SELECT u.id AS user_id, u.username, ux.xp, ux.level
            FROM user_xp ux
            JOIN users u ON u.id = ux.user_id
            ORDER BY ux.xp DESC
            LIMIT :limit
        """),
        {"limit": limit},
    )
    return [dict(row) for row in result.mappings()]
