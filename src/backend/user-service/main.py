from typing import Annotated
from datetime import datetime, timezone

from fastapi import FastAPI, status, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from service.schemas import (
    Login, LoginResponse, RefreshRequest, RegisterRequest, RegisterResponse,
    ProfileResponse, UpdateProfileRequest, MeResponse,
    FriendResponse, FriendRequestResponse, FriendRequestAction,
    NotificationResponse, GameNotificationRequest,
)
from service.models.user import User
from service.service import authenticate, refresh_access_token, register_credentials, get_profile, update_profile, get_me
import service.friends as _friends
from service.friends import (
    get_friends, get_pending_requests, get_sent_requests,
    delete_friendship, search_users,
)
import service.notifications as _notifications
from shared.database import get_db
from service.ws.presence_router import router as presence_router
from service.ws.notification_router import router as notification_router, notification_manager

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


@app.post("/auth/refresh", status_code=status.HTTP_200_OK, response_model=LoginResponse)
async def refresh(body: RefreshRequest, session: SessionDependency):
    return await refresh_access_token(body, session)


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

@app.get("/friends/me", response_model=list[FriendResponse])
async def list_friends(
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
):
    return await get_friends(current_user.id, session)


@app.get("/friends/me/requests", response_model=list[FriendRequestResponse])
async def list_friend_requests(
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
):
    return await get_pending_requests(current_user.id, session)


@app.get("/friends/me/sent", response_model=list[FriendRequestResponse])
async def list_sent_requests(
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
):
    return await get_sent_requests(current_user.id, session)


def _notif_payload(notif) -> dict:
    """Wrap a Notification object in the WS notification envelope."""
    created_at = notif.created_at
    if created_at is None:
        created_at = datetime.now(timezone.utc)
    return {
        "type": "notification",
        "notification": {
            "id": notif.id,
            "type": notif.type,
            "message": notif.message,
            "read": notif.read,
            "created_at": created_at.isoformat(),
        },
    }


def _game_notif_message(sender: str, body) -> str:
    """Return a human-readable notification message for each game event type."""
    if body.type == "game_invite":
        return f"{sender} invited you to play Pong"
    if body.type == "game_invite_response":
        if body.status == "accepted":
            return f"{sender} accepted your game invite"
        if body.status == "declined":
            return f"{sender} declined your game invite"
        return f"{sender} responded to your game invite"
    # game_invite_timeout
    return f"Your game invite with {sender} has expired"


@app.post("/friends/request/{addressee_id}",
          response_model=FriendRequestResponse, status_code=201)
async def add_friend(
    addressee_id: int,
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
):
    friendship = await _friends.send_friend_request(current_user.id, addressee_id, session)
    try:
        notif = await _notifications.create_notification(
            session, addressee_id, "friend_request",
            f"{current_user.username} sent you a friend request",
        )
        await notification_manager.broadcast(str(addressee_id), _notif_payload(notif))
    except ValueError as e:
        # Message length validation failed — log but don't fail the request
        # (friendship was already created)
        import sys
        print(f"[WARNING] Failed to create notification: {e}", file=sys.stderr)
    return friendship


@app.put("/friends/requests/{request_id}",
         response_model=FriendRequestResponse,
         responses={204: {"description": "Friend request declined"}})
async def respond_to_request(
    request_id: int,
    body: FriendRequestAction,
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
):
    result = await _friends.respond_to_friend_request(current_user.id, request_id, body.action, session)
    if body.action == "decline":
        return Response(status_code=204)
    
    try:
        notif = await _notifications.create_notification(
            session, result.requester_id, "friend_request_accepted",
            f"{current_user.username} accepted your friend request",
        )
        await notification_manager.broadcast(str(result.requester_id), _notif_payload(notif))
    except ValueError as e:
        # Message length validation failed — log but don't fail the request
        # (friendship acceptance was already processed)
        import sys
        print(f"[WARNING] Failed to create notification: {e}", file=sys.stderr)
    
    return result


@app.delete("/friends/{other_id}", status_code=204)
async def remove_friend(
    other_id: int,
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
):
    deleted = await delete_friendship(current_user.id, other_id, session)
    if not deleted:
        raise HTTPException(status_code=404, detail="Friendship not found")


@app.get("/search", response_model=list[FriendResponse])
async def search_users_endpoint(session: SessionDependency, q: str = ""):
    if len(q) < 2:
        return []
    return await search_users(q, session)


@app.get("/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
):
    """Return last 20 notifications for the authenticated caller, newest first."""
    notifications = await _notifications.get_notifications(session, current_user.id)
    return [NotificationResponse.model_validate(n) for n in notifications]


@app.put("/notifications/read-all", status_code=204)
async def read_all_notifications(
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
):
    """Mark all caller's notifications as read."""
    await _notifications.mark_all_notifications_read(session, current_user.id)
    return Response(status_code=204)


@app.put("/notifications/{notification_id}/read", response_model=NotificationResponse)
async def read_notification(
    notification_id: int,
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
):
    """Mark a single notification as read. Returns 404 if not owned by caller."""
    notif = await _notifications.mark_notification_read(session, notification_id, current_user.id)
    return NotificationResponse.model_validate(notif)


@app.delete("/notifications/{notification_id}", status_code=204)
async def remove_notification(
    notification_id: int,
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
):
    """Delete a single notification. Returns 404 if not owned by caller."""
    await _notifications.delete_notification(session, notification_id, current_user.id)
    return Response(status_code=204)


@app.post("/game-invites", status_code=204)
async def deliver_game_notification(
    body: GameNotificationRequest,
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
):
    """Deliver a game invite event to the target user's notification channel.

    from_user_id and from_username are always taken from the authenticated
    caller's JWT — client-supplied values in the body are ignored, preventing
    impersonation.
    """
    payload = {
        **body.model_dump(exclude_none=True, exclude={"from_user_id", "from_username"}),
        "from_user_id": current_user.id,
        "from_username": current_user.username,
    }
    try:
        notif = await _notifications.create_notification(
            session, body.to_user_id, body.type,
            _game_notif_message(current_user.username, body),
        )
    except ValueError as e:
        # Message length validation failed
        raise HTTPException(status_code=400, detail=str(e))
    
    await notification_manager.broadcast(str(body.to_user_id), payload)
    await notification_manager.broadcast(str(body.to_user_id), _notif_payload(notif))
    return Response(status_code=204)


app.include_router(presence_router)
app.include_router(notification_router)
