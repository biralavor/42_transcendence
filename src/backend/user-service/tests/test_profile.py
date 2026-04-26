# src/backend/user-service/tests/test_profile.py
from httpx import AsyncClient, ASGITransport
from service.main import app
from unittest.mock import AsyncMock, patch, MagicMock
import pytest

@pytest.mark.asyncio
async def test_get_profile_not_found():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/profile/9999")
    assert resp.status_code == 404

@pytest.mark.asyncio
async def test_update_profile_not_found():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.put("/profile/9999", json={"display_name": "X"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_first_friend_badge_unlocked_after_first_friendship():
    """first_friend badge is awarded when friend_count returns 1."""
    from service.persistence import reward_friendship_achievement_if_should

    mock_session = AsyncMock()
    inserted_keys = []

    async def fake_friend_count(uid, session):
        return 1

    async def fake_insert(uid, achievement, session):
        inserted_keys.append(achievement["a_key"])

    with patch("service.persistence.friend_count", side_effect=fake_friend_count), \
         patch("service.persistence.insert_user_achievement", side_effect=fake_insert):
        await reward_friendship_achievement_if_should(1, 2, mock_session)

    assert "first_friend" in inserted_keys, "first_friend badge should be inserted when friend count is 1"


@pytest.mark.asyncio
async def test_social_butterfly_badge_at_5_friends():
    """social_butterfly badge is awarded when friend_count reaches 5."""
    from service.persistence import reward_friendship_achievement_if_should

    mock_session = AsyncMock()
    inserted_keys = []

    async def fake_friend_count(uid, session):
        return 5

    async def fake_insert(uid, achievement, session):
        inserted_keys.append(achievement["a_key"])

    with patch("service.persistence.friend_count", side_effect=fake_friend_count), \
         patch("service.persistence.insert_user_achievement", side_effect=fake_insert):
        await reward_friendship_achievement_if_should(1, 2, mock_session)

    assert "social_butterfly" in inserted_keys, "social_butterfly badge should be inserted when friend count is 5"


@pytest.mark.asyncio
async def test_no_badge_when_friend_count_is_none():
    """No badge is inserted when friend_count returns None."""
    from service.persistence import reward_friendship_achievement_if_should

    mock_session = AsyncMock()
    inserted_keys = []

    async def fake_friend_count(uid, session):
        return None

    async def fake_insert(uid, achievement, session):
        inserted_keys.append(achievement["a_key"])

    with patch("service.persistence.friend_count", side_effect=fake_friend_count), \
         patch("service.persistence.insert_user_achievement", side_effect=fake_insert):
        await reward_friendship_achievement_if_should(1, 2, mock_session)

    assert inserted_keys == [], "No badges should be inserted when friend_count is None"
