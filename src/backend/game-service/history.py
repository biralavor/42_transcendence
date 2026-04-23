# src/backend/game-service/history.py
from sqlalchemy import select, or_, text
from sqlalchemy.ext.asyncio import AsyncSession

from service.models.match import Match
from service.schemas import MatchHistoryItem, MatchHistoryPage
from shared.util.order import get_order_by_str

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




def match_history_order_by_str(sort_assoc: list[tuple[str, str]] | None) -> str | None:
    valid_columns = [
        'date',
        'result'
    ]
    return get_order_by_str(sort_assoc, valid_columns)


def match_history_filter_str(search_for: dict) -> str | None:
    # include an always true clause so filter str is not empty
    filters = ['1 = 1']
    if search_for['result'] is not None:
        result = search_for['result'].lower()
        if result in ['win', 'loss']:
            filters.append(f"result = '{result.capitalize()}'")
    date_from = search_for['date_from']
    date_to = search_for['date_to']
    if date_from is not None and date_to is not None:
        filters.append(f"finished_at BETWEEN '{date_from}'::timestamp AND '{date_to}'::timestamp")
    elif date_from is not None:
        filters.append(f"finished_at > '{date_from}'::timestamp")
    elif date_to is not None:
        filters.append(f"finished_at < '{date_to}'::timestamp")
    query_filter_str = '\n\tAND '.join(filters)
    return query_filter_str

async def get_match_history_paginated(
        search_for: dict,
        sort_assoc: list[tuple[str, str]],
        session: AsyncSession
) -> MatchHistoryPage:
    page = search_for['page'] or 0
    limit = search_for['limit'] or 10
    offset = page * limit

    default_query_order = """
    date DESC
    """
    query_order = match_history_order_by_str(sort_assoc)

    query_order = query_order + ', ' + default_query_order \
        if query_order is not None else default_query_order
    query_filter = match_history_filter_str(search_for)
    statement = text(f"""
WITH all_finished_matches AS
(
    SELECT
        *
    FROM matches
    WHERE status IS NOT NULL AND status = 'finished'
)

,all_player_matches AS
(
    SELECT
        *
        , CASE WHEN player1_id = :player_id
                   THEN player1_id
               WHEN player2_id = :player_id
                   THEN player2_id
          END
        AS player_id
        , CASE WHEN NOT player1_id = :player_id
                   THEN player1_id
               WHEN NOT player2_id = :player_id
                   THEN player2_id
          END
        AS opponent_id
        , CASE WHEN player1_id = :player_id
                   THEN CONCAT(CONCAT(score_p1, '-'), score_p2)
               WHEN player2_id = :player_id
                   THEN CONCAT(CONCAT(score_p2, '-'), score_p1)
          END
        AS score
        , CASE WHEN winner_id = :player_id
                   THEN 'Win'
                   ELSE 'Loss'
          END
        AS result
        , finished_at::timestamp
        AS date

    FROM all_finished_matches
    WHERE
        player1_id = (:player_id)::int
        OR player2_id = (:player_id)::int
)
, filtered_matches AS
(
    SELECT * FROM all_player_matches
    WHERE {query_filter}
    ORDER BY {query_order}
)
, matches_count AS
(
    SELECT
        count(*) AS total_matches
    FROM filtered_matches
)

, paged_matches AS
(
    SELECT * FROM filtered_matches
    OFFSET (SELECT
               LEAST(:offset,
                     GREATEST(0, (table matches_count) - :limit))
            FROM matches_count)
    LIMIT :limit
)
, page_stats AS
(
    SELECT
      (table matches_count)
      AS total
      , LEAST(((:page)::int),
              GREATEST(0, (((table matches_count) - 1) / :limit)))
      AS page
      , (:limit)::int
      AS per_page
      , GREATEST(0, (((table matches_count) - 1) / :limit))
      AS last_page
)
SELECT
    *
    , COALESCE((SELECT
                  jsonb_agg(jsonb_build_object(
                     'id' ,player_id
                     , 'opponent_id'  ,opponent_id
                     , 'score'  ,score
                     , 'result' , result
                     , 'date'  ,date
                  ) ORDER BY {query_order})
                FROM paged_matches)
               , '[]'::jsonb)
    AS results
    FROM page_stats
    """)

    result = await session.execute(
        statement, {
            'player_id': search_for['player_id'],
            'offset': offset,
            'limit': limit,
            'page': page
        }
    )
    page_player_match_results = \
        result.mappings().one_or_none()
    return MatchHistoryPage.model_validate(
        page_player_match_results
    )
