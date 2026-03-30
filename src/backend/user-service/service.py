from fastapi import status, HTTPException
from service.schemas import Login, LoginResponse, RefreshRequest, RegisterRequest, RegisterResponse, UpdateProfileRequest, MeResponse
from service.models.credentials import Credentials, Tokens
from service.models.user import User
from datetime import datetime, timedelta, timezone
import bcrypt
import hashlib
import secrets
from jose import jwt, ExpiredSignatureError, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from shared.config.settings import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 1
REFRESH_TOKEN_EXPIRE_DAYS = 2


def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=ALGORITHM)


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
    access_token_expires = timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    access_token = create_access_token(
        data={"sub": credential.username}, expires_delta=access_token_expires
    )
    raw_refresh_token = secrets.token_hex(32)
    refresh_token_hash = hashlib.sha256(raw_refresh_token.encode()).hexdigest()
    token_row = await session.execute(select(Tokens).where(Tokens.credential_id == credential.id))
    tokens = token_row.scalars().first()
    if tokens is None:
        tokens = Tokens(credential_id=credential.id, token_type="bearer")
        session.add(tokens)
    tokens.refresh_token_hash = refresh_token_hash
    tokens.expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    await session.commit()
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        refresh_token=raw_refresh_token,
    )


async def refresh_access_token(body: RefreshRequest, session: AsyncSession) -> LoginResponse:
    token_hash = hashlib.sha256(body.refresh_token.encode()).hexdigest()
    token_row = await session.execute(select(Tokens).where(Tokens.refresh_token_hash == token_hash))
    tokens = token_row.scalars().first()
    if tokens is None or tokens.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    result = await session.execute(select(Credentials).where(Credentials.id == tokens.credential_id))
    credential = result.scalars().first()
    if credential is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    access_token = create_access_token(
        data={"sub": credential.username},
        expires_delta=timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
    )
    raw_refresh_token = secrets.token_hex(32)
    tokens.refresh_token_hash = hashlib.sha256(raw_refresh_token.encode()).hexdigest()
    tokens.expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
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
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already exists"
        ) from exc
    return RegisterResponse(username=credentials.username)


async def get_profile(user_id: int, session: AsyncSession) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalars().first()


async def get_me(token: str, session: AsyncSession) -> MeResponse:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise JWTError("missing sub")
    except ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        ) from exc
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc
    result = await session.execute(select(Credentials).where(Credentials.username == username))
    credential = result.scalars().first()
    if credential is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user_row = await session.execute(select(User).where(User.credential_id == credential.id))
    user = user_row.scalars().first()
    if user is None:
        user = User(username=credential.username, credential_id=credential.id)
        session.add(user)
        await session.commit()
        await session.refresh(user)
    return user


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
