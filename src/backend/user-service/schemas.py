from pydantic import BaseModel
from typing import Annotated
from sqlmodel import Field, SQLModel

class Credentials(SQLModel, table=True):
    id: Annotated[int | None, Field(default=None, primary_key=True)]
    username: str = Field(unique=True)
    password: str

class Tokens(SQLModel, table=True):
    id: Annotated[int | None, Field(default=None, primary_key=True)]
    credential_id: int = Field(foreign_key="credentials.id")
    access_token: str
    token_type: str
    refresh_token: str

class Login(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class RegisterRequest(BaseModel):
    username: str
    password: str

class RegisterResponse(BaseModel):
    username: str