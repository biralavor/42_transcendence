import re
import os
import httpx
from fastapi import FastAPI, HTTPException, status, Depends, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Annotated
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError, ExpiredSignatureError
from sqlalchemy import text

from shared.config.settings import settings
from shared.database import get_db
from service.ws.router import router as ws_router, manager
from service.persistence import (
    get_or_create_dm_room,
    block_user, unblock_user, get_blocked_ids,
    create_general_room, list_live_rooms,
)

_ALGORITHM = "HS256"
_DM_SLUG_RE = re.compile(r"^DM-(\d+)-(\d+)$")
_bearer = HTTPBearer()
_USER_SERVICE_PORT = os.getenv("USER_SERVICE_PORT", "8001")
_USER_SERVICE_URL = f"http://user-service:{_USER_SERVICE_PORT}"

SessionDep = Annotated[AsyncSession, Depends(get_db)]

app = FastAPI(title="Chat Service")



class CurrentUser(BaseModel):
    """User model returned from get_current_user()."""
    id: int
    username: str
    status: str
    display_name: str | None = None
    bio: str | None = None


async def _get_user_profile(db: AsyncSession, user_id: int) -> CurrentUser | None:
    """Query users table by id. Returns full CurrentUser or None."""
    result = await db.execute(
        text(
            "SELECT id, username, status, display_name, bio "
            "FROM users WHERE id = :uid"
        ),
        {"uid": user_id},
    )
    row = result.first()
    if not row:
        return None
    return CurrentUser(
        id=row[0],
        username=row[1],
        status=row[2],
        display_name=row[3],
        bio=row[4],
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    """Authenticate user via JWT and return profile.
    
    Pattern from game-service (updated to use uid from JWT):
    1. Decode JWT locally (validate signature)
    2. Extract uid (user.id directly)
    3. Query users table (fast path for repeat logins)
    4. If not found: call user-service GET /auth/me to create user row
    5. Return full CurrentUser object
    """
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

    # Fast path: lookup user by credential_id
    result = await db.execute(
        text("SELECT id FROM users WHERE credential_id = :cid"),
        {"cid": credential_id},
    )
    row = result.first()
    if row is not None:
        user_id = row[0]
        user = await _get_user_profile(db, user_id)
        if user is not None:
            return user

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

    # Re-query after user-service created the row
    result = await db.execute(
        text("SELECT id FROM users WHERE credential_id = :cid"),
        {"cid": credential_id},
    )
    row = result.first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    user_id = row[0]
    user = await _get_user_profile(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return user


CallerUser = Annotated[CurrentUser, Depends(get_current_user)]


@app.get("/health")
def health():
    return {"status": "ok", "service": "chat-service"}


@app.get("/")
def root():
    return {"message": "Chat Service"}


@app.post("/dm/{friend_id}", status_code=200)
async def create_dm_room(friend_id: int, session: SessionDep, caller: CallerUser):
    """Idempotently create or return the DM room between caller and friend_id."""
    if friend_id == caller.id:
        raise HTTPException(status_code=400, detail="Cannot DM yourself")
    room = await get_or_create_dm_room(session, user_a_id=caller.id, user_b_id=friend_id)
    return {"room_name": room.room_name}


@app.post("/block/{user_id}", status_code=204)
async def block(user_id: int, session: SessionDep, caller: CallerUser):
    await block_user(session, blocker_id=caller.id, blocked_id=user_id)
    return Response(status_code=204)


@app.delete("/block/{user_id}", status_code=204)
async def unblock(user_id: int, session: SessionDep, caller: CallerUser):
    await unblock_user(session, blocker_id=caller.id, blocked_id=user_id)
    return Response(status_code=204)


@app.get("/blocked", status_code=200)
async def list_blocked(session: SessionDep, caller: CallerUser):
    ids = await get_blocked_ids(session, user_id=caller.id)
    return sorted(ids)


class RoomCreate(BaseModel):
    room_name: str


@app.post("/rooms", status_code=201)
async def create_room(body: RoomCreate, session: SessionDep, caller: CallerUser):
    """Create a new general public room. Returns 400 for invalid name, 409 for duplicate."""
    room = await create_general_room(
        session, room_name=body.room_name, creator_name=caller.username
    )
    return {"room_name": room.room_name}


@app.get("/rooms", status_code=200)
async def get_live_rooms(session: SessionDep, caller: CallerUser):
    """List all general rooms with at least one active WebSocket connection."""
    return await list_live_rooms(session, manager)


@app.get("/room/{room_slug}/active")
async def room_active_connections(room_slug: str, caller: CallerUser):
    """Return active WebSocket connections in a DM room.

    Restricted to DM slugs (DM-{lo}-{hi}) where the caller is one of the two
    participants. Returns 403 for non-DM slugs or unauthorised callers.
    """
    match = _DM_SLUG_RE.match(room_slug)
    if match is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a DM room")
    lo, hi = int(match.group(1)), int(match.group(2))
    if caller.id not in (lo, hi):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant")
    return {"active_connections": manager.active_connections(room_slug)}


app.include_router(ws_router)
