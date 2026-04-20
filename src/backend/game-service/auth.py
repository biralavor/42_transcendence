import os

import httpx
from fastapi import Depends, HTTPException, status, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config.settings import settings
from shared.database import get_db

_optional_bearer = HTTPBearer(auto_error=False)
_bearer = HTTPBearer()
_ALGORITHM = "HS256"
_USER_SERVICE_PORT = os.getenv("USER_SERVICE_PORT", "8001")
_USER_SERVICE_URL = f"http://user-service:{_USER_SERVICE_PORT}"

async def get_optional_current_user_id_from_credentials(
        credentials: HTTPAuthorizationCredentials | None,
        db: AsyncSession,
) -> int | None:
    """Returns user_id from JWT if valid token present, otherwise None"""
    if not credentials:
        return None
    try:
        return await get_current_user_id_from_credentials(credentials, db)
    except HTTPException as exc:
        return None

async def get_player_id_or_me(
        session: AsyncSession = Depends(get_db),
        player_id: int | None = Query(None),
        credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
) -> int:
    """
    Returns player_id if provided.
    If not provided, requires authentication and returns current_user_id.
    """
    print('get_player_id_or_me top: ', player_id, credentials)
    if player_id is not None:
        return player_id

    user_id = await get_optional_current_user_id_from_credentials(
        credentials, session
    )
    if user_id is not None:
        return user_id

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Expected either a player_id query parameter or a valid bearer token"
    )


async def _lookup_user_id(db: AsyncSession, credential_id: int) -> int | None:
    result = await db.execute(
        text("SELECT id FROM users WHERE credential_id = :cid"),
        {"cid": credential_id},
    )
    row = result.first()
    return row[0] if row else None


async def get_current_user_id_from_credentials(
    credentials: HTTPAuthorizationCredentials,
    db: AsyncSession,
) -> int:
    try:
        payload = jwt.decode(
            credentials.credentials, settings.JWT_SECRET_KEY, algorithms=[_ALGORITHM]
        )
        credential_id: int | None = payload.get("credential_id")
        if credential_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
            )
    except ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        ) from exc
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc

    # Fast path: user already exists in the DB
    user_id = await _lookup_user_id(db, credential_id)
    if user_id is not None:
        return user_id

    # Fallback: call user-service /auth/me to auto-create the user row
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_USER_SERVICE_URL}/auth/me",
            headers={"Authorization": f"Bearer {credentials.credentials}"},
        )
    if resp.status_code == 401:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=resp.json().get("detail", "Invalid token")
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="User service unavailable"
        )
    # Return data from response if available
    response_data = resp.json()
    user_id_from_response = response_data.get("id")
    if user_id_from_response is not None:
        return user_id_from_response

    # Try to look again on database
    user_id = await _lookup_user_id(db, credential_id)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return user_id

async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> int:
    return await get_current_user_id_from_credentials(credentials, db)
