# src/backend/user-service/tests/test_friends.py
from unittest.mock import MagicMock

from httpx import AsyncClient, ASGITransport
from service.main import app, get_current_user
from service.schemas import FriendResponse
import pytest


# ----------------------------------------------------------------- #
# FriendResponse model_validator — pure unit tests                  #
# ----------------------------------------------------------------- #

class TestFriendResponseNormalizesDisplayName:
    def test_none_becomes_username(self):
        f = FriendResponse(id=1, username='alice', display_name=None, status='offline')
        assert f.display_name == 'alice'

    def test_empty_string_becomes_username(self):
        f = FriendResponse(id=1, username='alice', display_name='', status='offline')
        assert f.display_name == 'alice'

    def test_whitespace_becomes_username(self):
        f = FriendResponse(id=1, username='alice', display_name='  ', status='offline')
        assert f.display_name == 'alice'

    def test_valid_display_name_preserved(self):
        f = FriendResponse(id=1, username='alice', display_name='Alice B', status='offline')
        assert f.display_name == 'Alice B'

@pytest.mark.asyncio
async def test_list_friends_empty_for_unknown_user():
    fake_user = MagicMock()
    fake_user.id = 9999
    app.dependency_overrides[get_current_user] = lambda: fake_user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/friends/me")
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 200
    assert resp.json() == []

@pytest.mark.asyncio
async def test_list_requests_empty_for_unknown_user():
    fake_user = MagicMock()
    fake_user.id = 9999
    app.dependency_overrides[get_current_user] = lambda: fake_user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/friends/me/requests")
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 200
    assert resp.json() == []

@pytest.mark.asyncio
async def test_remove_friend_not_found():
    fake_user = MagicMock()
    fake_user.id = 9999
    app.dependency_overrides[get_current_user] = lambda: fake_user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.delete("/friends/8888")
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 404

@pytest.mark.asyncio
async def test_respond_to_request_not_found():
    fake_user = MagicMock()
    fake_user.id = 9999
    app.dependency_overrides[get_current_user] = lambda: fake_user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.put("/friends/requests/8888", json={"action": "accept"})
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 404

@pytest.mark.asyncio
async def test_respond_to_request_invalid_action():
    fake_user = MagicMock()
    fake_user.id = 9999
    app.dependency_overrides[get_current_user] = lambda: fake_user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.put("/friends/requests/8888", json={"action": "foo"})
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 422
