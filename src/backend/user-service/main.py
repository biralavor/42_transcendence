from typing import Annotated
from datetime import datetime, timezone
import logging

from fastapi import FastAPI, status, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from service.schemas import (
    Login, LoginResponse, RefreshRequest, RegisterRequest, RegisterResponse,
    ProfileResponse, UpdateProfileRequest, MeResponse,
    FriendResponse, FriendRequestResponse, FriendRequestAction,
    NotificationResponse, GameNotificationRequest, GameInviteResponseRequest,
    PreferencesResponse, PreferencesUpdateRequest, SearchResponse

)
from service.models.user import User
from service.service import authenticate, refresh_access_token, register_credentials, get_profile, update_profile, get_me
import service.avatar as _avatar
import service.friends as _friends
from service.friends import (
    get_friends, get_pending_requests, get_sent_requests,
    delete_friendship, search_users_paginated
)
import service.notifications as _notifications
from shared.database import get_db
from shared.util.order import get_sort_assoc_from_order_query
from service.ws.presence_router import router as presence_router
from service.ws.notification_router import router as notification_router, notification_manager

SessionDependency = Annotated[AsyncSession, Depends(get_db)]
bearer_scheme = HTTPBearer()

app = FastAPI(title="User Service")
logger = logging.getLogger(__name__)


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


@app.get("/preferences", response_model=PreferencesResponse)
async def get_preferences(
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
) -> PreferencesResponse:
    prefs = current_user.game_preferences or {}
    return PreferencesResponse(
        theme=prefs.get("theme", "classic"),
        ball_speed_multiplier=prefs.get("ball_speed_multiplier", 1.0),
    )


@app.patch("/preferences", response_model=PreferencesResponse)
async def update_preferences(
    body: PreferencesUpdateRequest,
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
) -> PreferencesResponse:
    current_user.game_preferences = {
        "theme": body.theme,
        "ball_speed_multiplier": body.ball_speed_multiplier,
    }
    await session.commit()
    await session.refresh(current_user)
    prefs = current_user.game_preferences
    return PreferencesResponse(
        theme=prefs["theme"],
        ball_speed_multiplier=prefs["ball_speed_multiplier"],
    )


@app.post("/avatar", status_code=200)
async def upload_avatar(
    session: SessionDependency,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> dict:
    return await _avatar.save_avatar(current_user, file, session)


@app.delete("/avatar", status_code=204)
async def delete_avatar(
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
):
    await _avatar.clear_avatar(current_user, session)
    return Response(status_code=204)


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
            "user_id": notif.user_id,
            "from_user_id": notif.from_user_id,
            "type": notif.type,
            "message": notif.message,
            "read": notif.read,
            "created_at": created_at.isoformat(),
        },
    }


def _game_notif_message(sender: str, body) -> str:
    """Return a human-readable notification message for each game/tournament event type."""
    if body.type == "game_invite":
        msg = f"{sender} invited you to play Pong"
        if body.room_id:
            msg += f" [ROOM_ID:{body.room_id}]"
        return msg
    if body.type == "game_invite_timeout":
        return f"Your game invite with {sender} has expired"
    if body.type == "tournament_full":
        return f"Your tournament is full and ready to start [TOURNAMENT_ID:{body.tournament_id}]"
    if body.type == "tournament_match_available":
        return f"You have a tournament match ready to play [TOURNAMENT_ID:{body.tournament_id}]"
    if body.type == "tournament_complete":
        return f"Tournament finished. Check the final standings [TOURNAMENT_ID:{body.tournament_id}]"
    return "Notification"


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
        await session.commit()  # Commit notification to DB before broadcasting
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

    # Commit the friendship + achievement work BEFORE attempting the notification.
    # `friends.respond_to_friend_request()` already calls
    # `reward_friendship_achievement_if_should()` inside its savepoint, so we
    # must NOT call it again here (it would duplicate friend_count queries +
    # achievement INSERT attempts). And committing now ensures that a notification
    # failure doesn't roll back the accepted friendship.
    await session.commit()

    try:
        notif = await _notifications.create_notification(
            session, result.requester_id, "friend_request_accepted",
            f"{current_user.username} accepted your friend request",
        )
        await session.commit()  # Commit notification to DB before broadcasting
        await notification_manager.broadcast(str(result.requester_id), _notif_payload(notif))
    except ValueError as e:
        # Message length validation failed — log but don't fail the request
        # (friendship acceptance was already committed above)
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


@app.get("/search" , response_model=SearchResponse)
async def search_users_endpoint(
        session: SessionDependency,
        q: str = Query(""),
        limit: int = Query(10, ge=1),
        page: int = Query(0, ge=0),
        order: str = Query("")
):
    if q is None or q == "":
        raise HTTPException(status_code=400, detail="missing required query-parameter q on /search")
    if len(q) < 2:
        return {
            'results': [],
            'total': 0,
            'page': 0,
            'per_page': 0,
            'last_page': 0
        }
    if limit > 50:
        limit = 50
    sort_assoc = get_sort_assoc_from_order_query(order)
    paginated_search_result = await search_users_paginated(
        q, limit, page, sort_assoc, session
    )
    return paginated_search_result



@app.post("/game-invite/response", status_code=201)
async def deliver_game_invite_response(
    body: GameInviteResponseRequest,
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
):
    """Create a game invite response notification for the original inviter.
    
    Called when user declines/accepts a game invite.
    Validates that to_user_id is not the current user (prevents self-targeting).
    Broadcasts the notification to the recipient via WS if they are online.
    """
    # Prevent self-targeting: cannot send response to yourself
    if body.to_user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Cannot send game invite response to yourself"
        )
    
    try:
        # Create message based on response status
        if body.status == 'declined':
            message = f"{current_user.username} declined your match invite"
        elif body.status == 'accepted':
            message = f"{current_user.username} accepted your match invite"
            # Include room_id in message for navigation (only on acceptance)
            if body.room_id:
                message += f" [ROOM_ID:{body.room_id}]"
        elif body.status == 'timeout':
            message = f"{current_user.username}'s invite expired"
        else:
            message = f"{current_user.username} responded to your match invite"
        
        notif = await _notifications.create_notification(
            session, body.to_user_id, "game_invite_response",
            message, from_user_id=current_user.id,
        )
        await session.commit()
        
        # Broadcast the notification to the recipient via WS (if online)
        await notification_manager.broadcast(str(body.to_user_id), _notif_payload(notif))
        
        return {"status": "ok", "notification_id": notif.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
):
    """Return last 20 notifications for the authenticated caller, newest first."""
    notifications = await _notifications.get_notifications(session, current_user.id)
    response_list = [NotificationResponse.model_validate(n) for n in notifications]
    return response_list


@app.put("/notifications/read-all", status_code=204)
async def read_all_notifications(
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
):
    """Mark all caller's notifications as read."""
    await _notifications.mark_all_notifications_read(session, current_user.id)
    await session.commit()  # Persist changes to database
    return Response(status_code=204)


@app.put("/notifications/{notification_id}/read", response_model=NotificationResponse)
async def read_notification(
    notification_id: int,
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
):
    """Mark a single notification as read. Returns 404 if not owned by caller."""
    notif = await _notifications.mark_notification_read(session, notification_id, current_user.id)
    await session.commit()  # Persist changes to database
    return NotificationResponse.model_validate(notif)


@app.delete("/notifications/{notification_id}", status_code=204)
async def remove_notification(
    notification_id: int,
    session: SessionDependency,
    current_user: User = Depends(get_current_user),
):
    """Delete a single notification. Returns 404 if not owned by caller."""
    await _notifications.delete_notification(session, notification_id, current_user.id)
    await session.commit()  # Persist changes to database
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
            from_user_id=current_user.id,  # Store sender ID for game_invite notifications
        )
    except ValueError as e:
        # Message length validation failed
        raise HTTPException(status_code=400, detail=str(e))
    
    await session.commit()  # Persist notification to database before broadcasting
    
    await notification_manager.broadcast(str(body.to_user_id), _notif_payload(notif))
    return Response(status_code=204)


app.include_router(presence_router)
app.include_router(notification_router)
