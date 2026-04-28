"""Tests for game-service/auth.py — JWT validation and current-user resolution.

Security-critical: this module gates every authenticated endpoint by decoding
the bearer token and resolving it to a user_id. Bugs here are auth bypasses.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt

from shared.config.settings import settings
from service.auth import (
    get_current_user_id_from_credentials,
    get_optional_current_user_id_from_credentials,
)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

ALG = "HS256"


def make_credentials(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def make_token(payload: dict) -> str:
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=ALG)


def make_db_with_user(user_id: int | None):
    """Mock AsyncSession whose execute().first() returns (user_id,) or None."""
    db = AsyncMock()
    result = MagicMock()
    if user_id is None:
        result.first.return_value = None
    else:
        result.first.return_value = (user_id,)
    db.execute.return_value = result
    return db


# --------------------------------------------------------------------------- #
# get_current_user_id_from_credentials — JWT validation paths
# --------------------------------------------------------------------------- #

class TestGetCurrentUserIdFromCredentials:
    @pytest.mark.asyncio
    async def test_valid_token_with_known_user_returns_user_id(self):
        token = make_token({"credential_id": 42, "exp": datetime.now(timezone.utc) + timedelta(hours=1)})
        db = make_db_with_user(user_id=999)
        result = await get_current_user_id_from_credentials(make_credentials(token), db)
        assert result == 999

    @pytest.mark.asyncio
    async def test_token_without_credential_id_raises_401(self):
        # Payload missing credential_id field
        token = make_token({"sub": "alice", "exp": datetime.now(timezone.utc) + timedelta(hours=1)})
        db = make_db_with_user(user_id=999)
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user_id_from_credentials(make_credentials(token), db)
        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Invalid token"

    @pytest.mark.asyncio
    async def test_expired_token_raises_401_with_token_expired(self):
        # exp in the past
        token = make_token({"credential_id": 42, "exp": datetime.now(timezone.utc) - timedelta(hours=1)})
        db = make_db_with_user(user_id=999)
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user_id_from_credentials(make_credentials(token), db)
        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Token expired"

    @pytest.mark.asyncio
    async def test_malformed_token_raises_401(self):
        db = make_db_with_user(user_id=999)
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user_id_from_credentials(
                make_credentials("not.a.valid.jwt"), db,
            )
        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Invalid token"

    @pytest.mark.asyncio
    async def test_token_signed_with_wrong_secret_raises_401(self):
        # Token signed with different secret
        bad_token = jwt.encode({"credential_id": 42}, "wrong-secret", algorithm=ALG)
        db = make_db_with_user(user_id=999)
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user_id_from_credentials(make_credentials(bad_token), db)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_token_with_alg_none_is_rejected(self):
        """Defense against the classic JWT 'alg: none' downgrade attack."""
        # python-jose disallows algorithm='none' by default
        with pytest.raises(Exception):
            jwt.encode({"credential_id": 42}, settings.JWT_SECRET_KEY, algorithm="none")


# --------------------------------------------------------------------------- #
# get_optional_current_user_id_from_credentials — used by public routes
# --------------------------------------------------------------------------- #

class TestGetOptionalCurrentUserIdFromCredentials:
    @pytest.mark.asyncio
    async def test_returns_none_when_no_credentials(self):
        db = make_db_with_user(user_id=None)
        result = await get_optional_current_user_id_from_credentials(None, db)
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_user_id_for_valid_credentials(self):
        token = make_token({"credential_id": 42, "exp": datetime.now(timezone.utc) + timedelta(hours=1)})
        db = make_db_with_user(user_id=777)
        result = await get_optional_current_user_id_from_credentials(make_credentials(token), db)
        assert result == 777

    @pytest.mark.asyncio
    async def test_returns_none_for_invalid_credentials_instead_of_raising(self):
        # Public routes shouldn't 401 — they should silently degrade
        db = make_db_with_user(user_id=999)
        result = await get_optional_current_user_id_from_credentials(
            make_credentials("malformed.token"), db,
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_for_expired_token_instead_of_raising(self):
        token = make_token({"credential_id": 42, "exp": datetime.now(timezone.utc) - timedelta(hours=1)})
        db = make_db_with_user(user_id=999)
        result = await get_optional_current_user_id_from_credentials(make_credentials(token), db)
        assert result is None
