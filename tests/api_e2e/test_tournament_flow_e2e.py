"""End-to-end test of the tournament round-robin scheduling.

Drives:
  1. Register 4 users (creator + 3 joiners)
  2. Creator opens a tournament (max_participants=4)
  3. Each non-creator joins
  4. Creator starts the tournament — server generates the round-robin schedule
  5. Verify scheduling invariants: 6 matches (4 choose 2), every pair appears
     exactly once, every player appears in 3 matches

We intentionally do NOT play matches to completion — that path requires a
ready-up coordination dance via WS that's not worth re-implementing here. The
schedule-generation code is where the actual round-robin bugs live (that's the
non-obvious logic), and this test catches them.

Catches: round-robin pairing math errors, missing pairs, duplicate pairs,
participants-not-saved-on-start regressions.
"""
import pytest
from conftest import register_user, auth_headers


@pytest.mark.asyncio
async def test_tournament_round_robin_schedule_is_complete_and_unique(api):
    creator = await register_user(api)
    p2 = await register_user(api)
    p3 = await register_user(api)
    p4 = await register_user(api)

    create = await api.post(
        "/api/game/tournaments",
        json={"name": f"E2E-{creator['user_id']}", "max_participants": 4},
        headers=auth_headers(creator["token"]),
    )
    assert create.status_code == 201, (
        f"create failed: {create.status_code} {create.text[:200]}"
    )
    tournament_id = create.json()["id"]

    for player in (p2, p3, p4):
        join = await api.post(
            f"/api/game/tournaments/{tournament_id}/join",
            headers=auth_headers(player["token"]),
        )
        assert join.status_code == 201, (
            f"{player['username']} join failed: {join.status_code} {join.text[:200]}"
        )

    start = await api.post(
        f"/api/game/tournaments/{tournament_id}/start",
        headers=auth_headers(creator["token"]),
    )
    assert start.status_code == 200, (
        f"start failed: {start.status_code} {start.text[:200]}"
    )
    detail = start.json()

    # Status flips off "open" once started.
    assert detail["status"] != "open", (
        f"tournament status should leave 'open' after start, got {detail['status']}"
    )

    # All 4 saved as participants.
    participant_ids = {p["user_id"] for p in detail["participants"]}
    expected = {creator["user_id"], p2["user_id"], p3["user_id"], p4["user_id"]}
    assert participant_ids == expected, (
        f"participants mismatch: got {participant_ids}, expected {expected}"
    )

    # Round-robin invariants for 4 players: C(4,2) = 6 unique pairs,
    # each player in (n-1)=3 matches.
    matches = detail["matches"]
    assert len(matches) == 6, (
        f"4-player round-robin must produce 6 matches, got {len(matches)}"
    )

    seen_pairs = set()
    appearances = {uid: 0 for uid in expected}
    for m in matches:
        p1_id = m["player1_id"]
        p2_id_match = m["player2_id"]
        assert p1_id is not None and p2_id_match is not None, (
            f"round-robin match must have both player IDs assigned upfront, "
            f"got player1={p1_id}, player2={p2_id_match}"
        )
        assert p1_id != p2_id_match, "a match cannot pair a player against themselves"
        # Order-independent pair.
        pair = tuple(sorted((p1_id, p2_id_match)))
        assert pair not in seen_pairs, (
            f"duplicate pairing {pair} — round-robin must produce unique pairs"
        )
        seen_pairs.add(pair)
        appearances[p1_id] += 1
        appearances[p2_id_match] += 1

    for uid, count in appearances.items():
        assert count == 3, (
            f"player {uid} appears in {count} matches, expected 3 (n-1 in round-robin)"
        )


@pytest.mark.asyncio
async def test_tournament_join_full_returns_409(api):
    """Joining a full tournament returns 409 (regression guard).

    Locks in the explicit 409 from `TournamentFull` so a refactor that drops
    the exception mapping to a generic 500 is caught immediately.
    """
    creator = await register_user(api)
    p2 = await register_user(api)
    p3 = await register_user(api)
    p4 = await register_user(api)
    p5 = await register_user(api)

    create = await api.post(
        "/api/game/tournaments",
        json={"name": f"Full-{creator['user_id']}", "max_participants": 4},
        headers=auth_headers(creator["token"]),
    )
    assert create.status_code == 201, (
        f"tournament create failed: {create.status_code} {create.text[:200]}"
    )
    tournament_id = create.json()["id"]

    for player in (p2, p3, p4):
        join = await api.post(
            f"/api/game/tournaments/{tournament_id}/join",
            headers=auth_headers(player["token"]),
        )
        assert join.status_code == 201

    overflow = await api.post(
        f"/api/game/tournaments/{tournament_id}/join",
        headers=auth_headers(p5["token"]),
    )
    assert overflow.status_code == 409, (
        f"5th joiner should get 409, got {overflow.status_code}"
    )
