from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, field_validator


class Login(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    refresh_token: str


class RegisterRequest(BaseModel):
    username: str
    password: str


class RegisterResponse(BaseModel):
    username: str


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:           int
    username:     str
    display_name: Optional[str] = None
    status:       str
    avatar_url:   Optional[str] = None
    created_at:   Optional[datetime] = None
    bio:          Optional[str] = None
    dark_mode:    bool = False


class MeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:            int
    username:      str
    credential_id: Optional[int] = None
    display_name:  Optional[str] = None
    status:        str
    avatar_url:    Optional[str] = None
    created_at:    Optional[datetime] = None
    bio:           Optional[str] = None
    dark_mode:     bool = False


class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    bio:          Optional[str] = None
    dark_mode:    Optional[bool] = None


class FriendResponse(BaseModel):
    """User info returned in friends list and search results."""
    model_config = ConfigDict(from_attributes=True)

    id:           int
    username:     str
    display_name: Optional[str] = None
    avatar_url:   Optional[str] = None
    status:       str


class FriendRequestResponse(BaseModel):
    """A pending friendship row returned from the requests endpoint."""
    model_config = ConfigDict(from_attributes=True)

    id:                 int
    requester_id:       int
    addressee_id:       int
    status:             str
    created_at:         Optional[datetime] = None
    requester_username: Optional[str] = None
    addressee_username: Optional[str] = None


class RefreshRequest(BaseModel):
    refresh_token: str


class FriendRequestAction(BaseModel):
    action: Literal["accept", "decline"]


# Allowed notification types — centralized here to enforce consistency
# If adding new types, update both here AND frontend type checks
NOTIFICATION_TYPES = Literal[
    "friend_request",
    "friend_request_accepted",
    "friend_request_declined",
    "game_invite",
    "game_invite_response",
    "game_invite_timeout",
    "unread_chat",
    "match_result",
]


class NotificationResponse(BaseModel):
    """Notification returned from API.
    
    The `type` field is restricted to a known set of notification types.
    Unknown types are rejected at validation time.
    """
    model_config = ConfigDict(from_attributes=True)

    id:         int
    user_id:    int
    type:       NOTIFICATION_TYPES  # Now validated against known types
    message:    str
    read:       bool
    created_at: datetime


class GameNotificationRequest(BaseModel):
    """Request to send a game-related notification.
    
    Only game-related notification types are allowed here. The server injects
    `from_user_id` and `from_username` from JWT auth to prevent impersonation.
    `to_user_id` must be positive and different from the authenticated user.
    """
    type: Literal["game_invite", "game_invite_response", "game_invite_timeout"]
    to_user_id: int
    room_id: str
    # game_invite
    to_username:     Optional[str] = None
    from_avatar_url: Optional[str] = None
    expires_at:      Optional[int] = None
    # game_invite_response
    status: Optional[Literal["accepted", "declined", "timeout"]] = None
    
    @field_validator('to_user_id')
    @classmethod
    def validate_to_user_id(cls, v: int) -> int:
        """Ensure to_user_id is a positive integer."""
        if v <= 0:
            raise ValueError('to_user_id must be a positive integer')
        return v
