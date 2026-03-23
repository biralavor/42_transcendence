# src/backend/game-service/history.py
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from service.models.match import Match
from service.schemas import MatchHistoryItem


async def get_match_history(user_id: int, session: AsyncSession) -> list[MatchHistoryItem]:
    result = await session.execute(
        select(Match).where(
            or_(Match.player1_id == user_id, Match.player2_id == user_id),
            Match.status == 'finished',
            Match.finished_at.is_not(None),
        ).order_by(Match.finished_at.desc())
    )
    matches = result.scalars().all()

    items = []
    for m in matches:
        is_player1   = m.player1_id == user_id
        user_score   = m.score_p1 if is_player1 else m.score_p2
        opp_score    = m.score_p2 if is_player1 else m.score_p1
        opponent_id  = m.player2_id if is_player1 else m.player1_id
        result_str   = "Win" if m.winner_id == user_id else "Loss"
        date_str     = m.finished_at.isoformat() if m.finished_at else ""
        items.append(MatchHistoryItem(
            id=m.id,
            opponent_id=opponent_id,
            result=result_str,
            score=f"{user_score}-{opp_score}",
            date=date_str,
        ))
    return items
