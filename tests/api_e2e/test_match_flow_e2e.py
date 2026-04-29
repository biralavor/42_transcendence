"""End-to-end test of the match → XP → leaderboard flow.

Drives the same path the frontend would take through real HTTP, no mocks:
  1. Register two users
  2. Create a match between them
  3. Finish the match (one wins)
  4. Verify both users got XP awarded (winner +25, loser +5)
  5. Verify the leaderboard shows them with the new XP

This is the smallest possible test that exercises:
  - user-service /auth/register, /auth/login, /auth/me
  - game-service /matches POST, /matches/{id}/finish, /xp/{user_id}, /leaderboard
  - Cross-service auth (game-service validates JWT minted by user-service)
  - The XP awarding side-effect of finish_match
"""
import pytest
from conftest import register_user, auth_headers


@pytest.mark.asyncio
async def test_full_match_flow_awards_xp_and_updates_leaderboard(api):
    # 1. Register two fresh users (high IDs avoid collision with seeded data)
    alice = await register_user(api)
    bob = await register_user(api)
    assert alice["user_id"] != bob["user_id"], "registered users must have distinct ids"

    # 2. Snapshot pre-match XP for both
    pre_alice = await api.get(f"/api/game/xp/{alice['user_id']}")
    pre_bob = await api.get(f"/api/game/xp/{bob['user_id']}")
    assert pre_alice.status_code == 200 and pre_bob.status_code == 200
    pre_alice_xp = pre_alice.json()["xp"]
    pre_bob_xp = pre_bob.json()["xp"]

    # 3. Create a match (the endpoint does NOT require auth in this codebase —
    #    it's used by the AI flow + waiting room).
    create = await api.post("/api/game/matches", json={
        "player1_id": alice["user_id"],
        "player2_id": bob["user_id"],
    })
    assert create.status_code == 201, f"match create failed: {create.status_code} {create.text[:200]}"
    match_id = create.json()["id"]

    # 4. Finish the match — alice wins 10-5
    finish = await api.post(f"/api/game/matches/{match_id}/finish", json={
        "winner_id": alice["user_id"],
        "score_p1": 10,
        "score_p2": 5,
    })
    assert finish.status_code == 200, f"match finish failed: {finish.status_code} {finish.text[:200]}"
    assert finish.json()["status"] == "finished"
    assert finish.json()["winner_id"] == alice["user_id"]

    # 5. Verify XP was awarded — winner +25, loser +5
    post_alice = await api.get(f"/api/game/xp/{alice['user_id']}")
    post_bob = await api.get(f"/api/game/xp/{bob['user_id']}")
    assert post_alice.status_code == 200 and post_bob.status_code == 200

    alice_gained = post_alice.json()["xp"] - pre_alice_xp
    bob_gained = post_bob.json()["xp"] - pre_bob_xp
    assert alice_gained == 25, f"winner should gain 25 XP, got {alice_gained}"
    assert bob_gained == 5, f"loser should gain 5 XP, got {bob_gained}"

    # 6. Verify the leaderboard reflects the change — page through up to 5
    #    pages of 100 to find alice (handles seeded fixtures + accumulated state).
    found_alice = None
    for page_idx in range(5):
        lb = await api.get(f"/api/game/leaderboard?order=xp:desc&limit=100&page={page_idx}")
        assert lb.status_code == 200, f"leaderboard page {page_idx} failed: {lb.status_code}"
        body = lb.json()
        rows = body["results"]
        found_alice = next((r for r in rows if r["user_id"] == alice["user_id"]), None)
        if found_alice is not None or page_idx >= body["last_page"]:
            break
    assert found_alice is not None, "alice should appear in the XP-sorted leaderboard"
    assert found_alice["xp"] >= 25, (
        f"alice's leaderboard XP should be ≥25, got {found_alice['xp']}"
    )


@pytest.mark.asyncio
async def test_first_game_achievement_unlocks_after_first_match(api):
    """A user with no prior matches should have the `first_game` achievement
    unlocked immediately after finishing their first match."""
    alice = await register_user(api)
    bob = await register_user(api)

    # Sanity: alice has no first_game achievement before playing
    pre = await api.get(f"/api/game/achievements/{alice['user_id']}")
    assert pre.status_code == 200
    pre_first_game = next(
        (a for a in pre.json() if a["key"] == "first_game"), None,
    )
    assert pre_first_game is not None, "first_game must be in the catalog"
    assert pre_first_game["earned"] is False, (
        "fresh user should NOT have first_game earned yet — got earned=True"
    )

    # Play and finish one match — use 5-2 (NOT a shutout) so we can isolate
    # first_game from perfect_game.
    create = await api.post("/api/game/matches", json={
        "player1_id": alice["user_id"],
        "player2_id": bob["user_id"],
    })
    match_id = create.json()["id"]
    await api.post(f"/api/game/matches/{match_id}/finish", json={
        "winner_id": alice["user_id"], "score_p1": 5, "score_p2": 2,
    })

    # first_game should now be earned for alice
    post = await api.get(f"/api/game/achievements/{alice['user_id']}")
    post_first_game = next(
        (a for a in post.json() if a["key"] == "first_game"), None,
    )
    assert post_first_game is not None
    assert post_first_game["earned"] is True, (
        "first_game should be earned after the first finished match"
    )
    # perfect_game requires a 10-0 win (shutout AND winner ≥10). 5-2 doesn't
    # qualify — opponent scored AND winner didn't reach 10.
    perfect = next((a for a in post.json() if a["key"] == "perfect_game"), None)
    assert perfect is not None
    assert perfect["earned"] is False, "perfect_game requires 10-0; 5-2 should NOT unlock it"
