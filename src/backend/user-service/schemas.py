from datetime import datetime
from typing import Optional
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


class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    bio:          Optional[str] = None
    dark_mode:    Optional[bool] = None
