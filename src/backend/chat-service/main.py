from fastapi import FastAPI, HTTPException, status, Depends, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from typing import Annotated
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config.settings import settings
from shared.database import get_db
from service.ws.router import router as ws_router
from service.persistence import (
    get_or_create_dm_room,
    block_user, unblock_user, get_blocked_ids,
)

_ALGORITHM = "HS256"
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


CallerUid = Annotated[int, Depends(_decode_uid)]


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
