from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict


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
