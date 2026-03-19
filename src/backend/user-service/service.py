from fastapi import status, HTTPException
from service.schemas import Login, LoginResponse, RegisterRequest, RegisterResponse, UpdateProfileRequest
from service.models.credentials import Credentials, Tokens
from service.models.user import User
from datetime import datetime, timedelta, timezone
import bcrypt
import hashlib
import secrets
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

SECRET_KEY = "secret"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def hash_password(password: str) -> bytes:
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt)


async def authenticate(login: Login, session: AsyncSession) -> LoginResponse:
    password_bytes = login.password.encode('utf-8')
    result = await session.execute(select(Credentials).where(Credentials.username == login.username))
    credential = result.scalars().first()
    is_authenticated = (credential is not None
        and bcrypt.checkpw(password_bytes, credential.password.encode('utf-8')))
    if not is_authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": credential.username}, expires_delta=access_token_expires
    )
    raw_refresh_token = secrets.token_hex(32)
    refresh_token_hash = hashlib.sha256(raw_refresh_token.encode()).hexdigest()
    tokens = Tokens(
        credential_id=credential.id,
        token_type="bearer",
        refresh_token_hash=refresh_token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    session.add(tokens)
    await session.commit()
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        refresh_token=raw_refresh_token,
    )


async def register_credentials(register_request: RegisterRequest, session: AsyncSession) -> RegisterResponse:
    result = await session.execute(select(Credentials).where(Credentials.username == register_request.username))
    entity = result.scalars().first()
    if entity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already exists"
        )
    credentials = Credentials(
        username=register_request.username,
        password=hash_password(register_request.password).decode('utf-8'),
    )
    try:
        session.add(credentials)
        await session.commit()
        await session.refresh(credentials)
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already exists"
        )
    return RegisterResponse(username=credentials.username)


async def get_profile(user_id: int, session: AsyncSession) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalars().first()


async def update_profile(
    user_id: int, data: UpdateProfileRequest, session: AsyncSession
) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if user is None:
        return None
    if data.display_name is not None:
        user.display_name = data.display_name
    if data.bio is not None:
        user.bio = data.bio
    if data.dark_mode is not None:
        user.dark_mode = data.dark_mode
    await session.commit()
    await session.refresh(user)
    return user
