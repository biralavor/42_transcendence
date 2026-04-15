from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


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

class SearchResponse(BaseModel):
    results: list[FriendResponse]
    total: int
    page: int
    per_page: int
    last_page: int

class RefreshRequest(BaseModel):
    refresh_token: str


class FriendRequestAction(BaseModel):
    action: Literal["accept", "decline"]

class GameInviteResponseRequest(BaseModel):
    """Request to notify the inviter of a declined/accepted game invite.
    
    Sent by User B after declining/accepting a game invite from User A.
    Creates a notification for User A.
    
    Note: Validation in endpoint also ensures to_user_id != current_user.id
    to prevent self-targeting.
    """
    to_user_id: int
    status: Literal["declined", "accepted", "timeout"]
    room_id: str | None = None  # Game room ID (only for accepted responses)
    
    @field_validator('to_user_id')
    @classmethod
    def validate_to_user_id(cls, v: int) -> int:
        """Ensure to_user_id is a positive integer."""
        if v <= 0:
            raise ValueError('to_user_id must be a positive integer')
        return v


class GameInviteResponseRequest(BaseModel):
    """Request to notify the inviter of a declined/accepted game invite.
    
    Sent by User B after declining/accepting a game invite from User A.
    Creates a notification for User A.
    
    Note: Validation in endpoint also ensures to_user_id != current_user.id
    to prevent self-targeting.
    """
    to_user_id: int
    status: Literal["declined", "accepted", "timeout"]
    room_id: str | None = None  # Game room ID (only for accepted responses)
    
    @field_validator('to_user_id')
    @classmethod
    def validate_to_user_id(cls, v: int) -> int:
        """Ensure to_user_id is a positive integer."""
        if v <= 0:
            raise ValueError('to_user_id must be a positive integer')
        return v


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
    from_user_id: int | None = None  # Sender for game_invite notifications
    type:       NOTIFICATION_TYPES  # Now validated against known types
    message:    str
    read:       bool
    created_at: datetime


class PreferencesResponse(BaseModel):
    theme: str
    ball_speed_multiplier: float


class PreferencesUpdateRequest(BaseModel):
    theme: Literal["classic", "neon-pong", "neon-two-paddle", "neon-central-paddle", "wood"] = "classic"
    ball_speed_multiplier: float = Field(ge=0.5, le=2.0, default=1.0)


class GameNotificationRequest(BaseModel):
    """Request to send a game-related notification.
    
    Only game INVITE notification types are allowed here (not responses).
    Responses must use the dedicated /game-invite/response endpoint.
    The server injects `from_user_id` and `from_username` from JWT auth to prevent impersonation.
    `to_user_id` must be positive and different from the authenticated user.
    """
    type: Literal["game_invite", "game_invite_timeout"]  # Removed game_invite_response
    to_user_id: int
    room_id: str
    # game_invite
    to_username:     Optional[str] = None
    from_avatar_url: Optional[str] = None
    expires_at:      Optional[int] = None
    
    @field_validator('to_user_id')
    @classmethod
    def validate_to_user_id(cls, v: int) -> int:
        """Ensure to_user_id is a positive integer."""
        if v <= 0:
            raise ValueError('to_user_id must be a positive integer')
        return v
