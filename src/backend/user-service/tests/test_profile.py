# src/backend/user-service/tests/test_profile.py
from httpx import AsyncClient, ASGITransport
from service.main import app
from service.schemas import ProfileResponse, _coalesce_display_name
from unittest.mock import AsyncMock, patch
import pytest


# ----------------------------------------------------------------- #
# _coalesce_display_name helper — pure unit tests                   #
# ----------------------------------------------------------------- #

class TestCoalesceDisplayName:
    def test_none_falls_back_to_username(self):
        assert _coalesce_display_name(None, 'alice') == 'alice'

    def test_empty_string_falls_back_to_username(self):
        assert _coalesce_display_name('', 'alice') == 'alice'

    def test_whitespace_only_falls_back_to_username(self):
        assert _coalesce_display_name('   ', 'alice') == 'alice'

    def test_valid_name_is_trimmed_and_returned(self):
        assert _coalesce_display_name('  Alice B  ', 'alice') == 'Alice B'

    def test_valid_name_without_padding_returned_unchanged(self):
        assert _coalesce_display_name('Alice B', 'alice') == 'Alice B'


# ----------------------------------------------------------------- #
# ProfileResponse model_validator — pure unit tests                 #
# ----------------------------------------------------------------- #

class TestProfileResponseNormalizesDisplayName:
    def test_none_becomes_username(self):
        p = ProfileResponse(id=1, username='alice', display_name=None, status='offline')
        assert p.display_name == 'alice'

    def test_empty_string_becomes_username(self):
        p = ProfileResponse(id=1, username='alice', display_name='', status='offline')
        assert p.display_name == 'alice'

    def test_whitespace_becomes_username(self):
        p = ProfileResponse(id=1, username='alice', display_name='  ', status='offline')
        assert p.display_name == 'alice'

    def test_valid_display_name_preserved(self):
        p = ProfileResponse(id=1, username='alice', display_name='Alice B', status='offline')
        assert p.display_name == 'Alice B'


# ----------------------------------------------------------------- #
# GET /profile/{id} endpoint — display_name normalization via HTTP  #
# ----------------------------------------------------------------- #

def _fake_profile(display_name):
    return {
        'id': 1, 'credential_id': 10, 'username': 'alice', 'display_name': display_name,
        'status': 'offline', 'avatar_url': None, 'created_at': None, 'bio': None,
    }


@pytest.mark.asyncio
async def test_profile_endpoint_coalesces_empty_display_name():
    """Backend must not send '' — returns username as display_name instead."""
    with patch('service.main.get_profile', AsyncMock(return_value=_fake_profile(''))), \
         patch('service.main.get_credential_email', AsyncMock(return_value='alice@example.com')):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get("/profile/1")
    assert resp.status_code == 200
    assert resp.json()['display_name'] == 'alice'


@pytest.mark.asyncio
async def test_profile_endpoint_coalesces_none_display_name():
    """Backend must not send null — returns username as display_name instead."""
    with patch('service.main.get_profile', AsyncMock(return_value=_fake_profile(None))), \
         patch('service.main.get_credential_email', AsyncMock(return_value='alice@example.com')):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get("/profile/1")
    assert resp.status_code == 200
    assert resp.json()['display_name'] == 'alice'


@pytest.mark.asyncio
async def test_profile_endpoint_preserves_valid_display_name():
    """When display_name is set, the endpoint returns it unchanged."""
    with patch('service.main.get_profile', AsyncMock(return_value=_fake_profile('Alice B'))), \
         patch('service.main.get_credential_email', AsyncMock(return_value='alice@example.com')):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get("/profile/1")
    assert resp.status_code == 200
    assert resp.json()['display_name'] == 'Alice B'

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
