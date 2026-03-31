from typing import Annotated

from fastapi import FastAPI, status, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from service.schemas import (
    Login, LoginResponse, RegisterRequest, RegisterResponse,
    ProfileResponse, UpdateProfileRequest, MeResponse,
    FriendResponse, FriendRequestResponse, FriendRequestAction,
)
from service.models.user import User
from service.service import authenticate, register_credentials, get_profile, update_profile, get_me
from service.friends import (
    get_friends, get_pending_requests, get_sent_requests, send_friend_request,
    respond_to_friend_request, delete_friendship, search_users,
)
from shared.database import get_db
from service.ws.presence_router import router as presence_router

SessionDependency = Annotated[AsyncSession, Depends(get_db)]
bearer_scheme = HTTPBearer()

app = FastAPI(title="User Service")


async def get_current_user(
    session: SessionDependency,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> User:
    """Decode the Bearer JWT and return the authenticated User."""
    return await get_me(credentials.credentials, session)


@app.get("/health")
def health():
    return {"status": "ok", "service": "user-service"}


@app.get("/")
def root():
    return {"message": "User Service"}


@app.post("/auth/login", status_code=status.HTTP_200_OK, response_model=LoginResponse)
async def login(login: Login, session: SessionDependency):
    return await authenticate(login, session)


@app.get("/auth/me", response_model=MeResponse)
async def me(
    session: SessionDependency,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    return await get_me(credentials.credentials, session)


@app.post("/auth/register", status_code=status.HTTP_201_CREATED, response_model=RegisterResponse)
async def create_credentials(register_request: RegisterRequest, session: SessionDependency):
    return await register_credentials(register_request, session)


# TODO(auth): both endpoints below must be protected once JWT auth lands.
# GET  — add an auth dependency; any authenticated user may read any profile.
# PUT  — derive user_id from the JWT subject and reject if it doesn't match
#         the path param (prevents one user from overwriting another's profile).
@app.get("/profile/{user_id}", response_model=ProfileResponse)
async def get_user_profile(user_id: int, session: SessionDependency):
    profile = await get_profile(user_id, session)
    if profile is None:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


@app.put("/profile/{user_id}", response_model=ProfileResponse)
async def update_user_profile(
    user_id: int, data: UpdateProfileRequest, session: SessionDependency
):
    profile = await update_profile(user_id, data, session)
    if profile is None:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


# TODO(auth): friend endpoints must check JWT identity before modifying
# relationship data. user_id in path should equal JWT subject.

@app.get("/friends/{user_id}", response_model=list[FriendResponse])
async def list_friends(user_id: int, session: SessionDependency):
    return await get_friends(user_id, session)


@app.get("/friends/{user_id}/requests", response_model=list[FriendRequestResponse])
async def list_friend_requests(user_id: int, session: SessionDependency):
    return await get_pending_requests(user_id, session)


@app.get("/friends/{user_id}/sent", response_model=list[FriendRequestResponse])
async def list_sent_requests(user_id: int, session: SessionDependency):
    return await get_sent_requests(user_id, session)


@app.post("/friends/{user_id}/request/{addressee_id}",
          response_model=FriendRequestResponse, status_code=201)
async def add_friend(user_id: int, addressee_id: int, session: SessionDependency):
    return await send_friend_request(user_id, addressee_id, session)


@app.put("/friends/{user_id}/requests/{request_id}",
         response_model=FriendRequestResponse,
         responses={204: {"description": "Friend request declined"}})
async def respond_to_request(
    user_id: int, request_id: int,
    body: FriendRequestAction,
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    result = await respond_to_friend_request(user_id, request_id, body.action, session)
    if body.action == "decline":
        from fastapi.responses import Response
        return Response(status_code=204)
    return result


@app.delete("/friends/{user_id}/{other_id}", status_code=204)
async def remove_friend(user_id: int, other_id: int, session: SessionDependency):
    deleted = await delete_friendship(user_id, other_id, session)
    if not deleted:
        raise HTTPException(status_code=404, detail="Friendship not found")


@app.get("/search", response_model=list[FriendResponse])
async def search_users_endpoint(session: SessionDependency, q: str = ""):
    if len(q) < 2:
        return []
    return await search_users(q, session)


app.include_router(presence_router)
