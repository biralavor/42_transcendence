import re
from fastapi import FastAPI, HTTPException, status, Depends, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from typing import Annotated
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

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

SessionDep = Annotated[AsyncSession, Depends(get_db)]

app = FastAPI(title="Chat Service")
app.include_router(ws_router)


def _decode_uid(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> int:
    """Decode the Bearer JWT and return the caller's user id (uid claim)."""
    try:
        payload = jwt.decode(credentials.credentials, settings.JWT_SECRET_KEY, algorithms=[_ALGORITHM])
        uid = payload.get("uid")
        if uid is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing uid")
        return int(uid)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token uid is not a valid integer")


def _decode_username(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> str:
    """Decode the Bearer JWT and return the caller's username (sub claim)."""
    try:
        payload = jwt.decode(credentials.credentials, settings.JWT_SECRET_KEY, algorithms=[_ALGORITHM])
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing sub")
        return str(sub)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


CallerUid = Annotated[int, Depends(_decode_uid)]
CallerUsername = Annotated[str, Depends(_decode_username)]


@app.get("/health")
def health():
    return {"status": "ok", "service": "chat-service"}


@app.get("/")
def root():
    return {"message": "Chat Service"}


@app.post("/dm/{friend_id}", status_code=200)
async def create_dm_room(friend_id: int, session: SessionDep, caller_uid: CallerUid):
    """Idempotently create or return the DM room between caller and friend_id."""
    if friend_id == caller_uid:
        raise HTTPException(status_code=400, detail="Cannot DM yourself")
    room = await get_or_create_dm_room(session, user_a_id=caller_uid, user_b_id=friend_id)
    return {"room_name": room.room_name}


@app.post("/block/{user_id}", status_code=204)
async def block(user_id: int, session: SessionDep, caller_uid: CallerUid):
    await block_user(session, blocker_id=caller_uid, blocked_id=user_id)
    return Response(status_code=204)


@app.delete("/block/{user_id}", status_code=204)
async def unblock(user_id: int, session: SessionDep, caller_uid: CallerUid):
    await unblock_user(session, blocker_id=caller_uid, blocked_id=user_id)
    return Response(status_code=204)


@app.get("/blocked", status_code=200)
async def list_blocked(session: SessionDep, caller_uid: CallerUid):
    ids = await get_blocked_ids(session, user_id=caller_uid)
    return sorted(ids)


class RoomCreate(BaseModel):
    room_name: str


@app.post("/rooms", status_code=201)
async def create_room(body: RoomCreate, session: SessionDep, caller_uid: CallerUid, caller_username: CallerUsername):
    """Create a new general public room. Returns 400 for invalid name, 409 for duplicate."""
    room = await create_general_room(
        session, room_name=body.room_name, creator_name=caller_username
    )
    return {"room_name": room.room_name}


@app.get("/rooms", status_code=200)
async def get_live_rooms(session: SessionDep, caller_uid: CallerUid):
    """List all general rooms with at least one active WebSocket connection."""
    return await list_live_rooms(session, manager)


@app.get("/room/{room_slug}/active")
async def room_active_connections(room_slug: str, caller_uid: CallerUid):
    """Return active WebSocket connections in a DM room.

    Restricted to DM slugs (DM-{lo}-{hi}) where the caller is one of the two
    participants. Returns 403 for non-DM slugs or unauthorised callers.
    """
    match = _DM_SLUG_RE.match(room_slug)
    if match is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a DM room")
    lo, hi = int(match.group(1)), int(match.group(2))
    if caller_uid not in (lo, hi):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant")
    return {"active_connections": manager.active_connections(room_slug)}
