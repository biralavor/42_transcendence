"""Cross-service JWT acceptance smoke test.

A token minted by user-service must be accepted by:
  - user-service itself (sanity)
  - game-service (uses Depends(get_current_user_id))
  - chat-service (uses CallerUser dep)

If any service rejects the token with 401, JWT_SECRET_KEY has drifted between
services. This is a silent class of bug — auth works locally but breaks one
specific cross-service path. The historical incident: secret rotation in
.env that wasn't propagated to all 3 service containers.
"""
import pytest
from conftest import register_user, auth_headers


@pytest.mark.asyncio
async def test_jwt_accepted_by_all_three_services(api):
    user = await register_user(api)
    headers = auth_headers(user["token"])

    me = await api.get("/api/users/auth/me", headers=headers)
    assert me.status_code == 200, (
        f"user-service rejected its own token: {me.status_code} {me.text[:200]}"
    )

    # game-service: POST /tournaments uses Depends(get_current_user_id) — strict auth.
    # Most game-service GETs are public, so we exercise a POST that succeeds with
    # a valid token. The created tournament is a small side effect, bounded by
    # max_participants=4 and never started/joined by anyone else.
    game = await api.post(
        "/api/game/tournaments",
        json={"name": f"jwt-{user['user_id']}", "max_participants": 4},
        headers=headers,
    )
    assert game.status_code == 201, (
        f"game-service rejected user-service token (JWT_SECRET_KEY drift?): "
        f"{game.status_code} {game.text[:200]}"
    )

    chat = await api.get("/api/chat/blocked", headers=headers)
    assert chat.status_code == 200, (
        f"chat-service rejected user-service token (JWT_SECRET_KEY drift?): "
        f"{chat.status_code} {chat.text[:200]}"
    )


@pytest.mark.asyncio
async def test_invalid_jwt_rejected_by_all_three_services(api):
    """Negative path — a forged token must be rejected by every service.

    Catches the inverse failure: a service that *accepts any token* (e.g.,
    auth dependency replaced with a mock that was never reverted).
    """
    bad_headers = {"Authorization": "Bearer not.a.valid.jwt"}

    me = await api.get("/api/users/auth/me", headers=bad_headers)
    assert me.status_code == 401, (
        f"user-service should reject bad token: {me.status_code}"
    )

    # Same reasoning as above — POST /tournaments uses strict auth.
    # Bad token is rejected at the dep before any DB write happens.
    game = await api.post(
        "/api/game/tournaments",
        json={"name": "should-not-create", "max_participants": 4},
        headers=bad_headers,
    )
    assert game.status_code == 401, (
        f"game-service should reject bad token: {game.status_code}"
    )

    chat = await api.get("/api/chat/blocked", headers=bad_headers)
    assert chat.status_code == 401, (
        f"chat-service should reject bad token: {chat.status_code}"
    )
