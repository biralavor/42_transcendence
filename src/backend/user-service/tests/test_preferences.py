import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import MagicMock

from service.main import app, get_current_user


def _make_user(game_preferences=None):
    u = MagicMock()
    u.id = 42
    u.username = "testuser"
    u.game_preferences = game_preferences
    return u


# ── GET /preferences ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_preferences_defaults_when_null():
    user = _make_user(game_preferences=None)
    app.dependency_overrides[get_current_user] = lambda: user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/preferences")
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 200
    data = resp.json()
    assert data["theme"] == "classic"
    assert data["ball_speed_multiplier"] == 1.0


@pytest.mark.asyncio
async def test_get_preferences_returns_stored_values():
    user = _make_user(game_preferences={"theme": "wood", "ball_speed_multiplier": 1.5})
    app.dependency_overrides[get_current_user] = lambda: user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/preferences")
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 200
    data = resp.json()
    assert data["theme"] == "wood"
    assert data["ball_speed_multiplier"] == 1.5


# ── PATCH /preferences ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_patch_preferences_returns_updated_values():
    user = _make_user()
    # After commit/refresh, game_preferences reflects the written value
    # Since mock session's refresh is a no-op, we simulate by setting on the object
    async def _fake_current_user():
        return user

    app.dependency_overrides[get_current_user] = lambda: user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.patch("/preferences", json={"theme": "neon-pong", "ball_speed_multiplier": 0.75})
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 200
    data = resp.json()
    assert data["theme"] == "neon-pong"
    assert data["ball_speed_multiplier"] == 0.75


@pytest.mark.asyncio
async def test_patch_preferences_rejects_invalid_theme():
    user = _make_user()
    app.dependency_overrides[get_current_user] = lambda: user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.patch("/preferences", json={"theme": "galaxy", "ball_speed_multiplier": 1.0})
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_patch_preferences_rejects_speed_out_of_range():
    user = _make_user()
    app.dependency_overrides[get_current_user] = lambda: user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.patch("/preferences", json={"theme": "classic", "ball_speed_multiplier": 5.0})
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_patch_preferences_defaults_to_classic_and_1x():
    user = _make_user()
    app.dependency_overrides[get_current_user] = lambda: user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.patch("/preferences", json={})
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 200
    data = resp.json()
    assert data["theme"] == "classic"
    assert data["ball_speed_multiplier"] == 1.0
