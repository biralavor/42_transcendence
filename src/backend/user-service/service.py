from fastapi import status, HTTPException
from service.schemas import Credentials, Login, Tokens, RegisterRequest, RegisterResponse
from datetime import datetime, timedelta, timezone
import bcrypt
import secrets
from jose import jwt
from sqlmodel import Session, select
from sqlalchemy.exc import IntegrityError

SECRET_KEY = "secret"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def hash_password(password: str) -> bytes:
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed

def authenticate(login: Login, session: Session) -> Tokens:
    password_bytes = login.password.encode('utf-8')
    credential = session.exec(select(Credentials).where(Credentials.username == login.username)).first()
    is_authenticated = (credential is not None
        and login.username == credential.username
        and bcrypt.checkpw(password_bytes, credential.password.encode('utf-8')))
    if (not is_authenticated):
        raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": credential.username}, expires_delta=access_token_expires
    )
    tokens = Tokens(credential_id=credential.id, access_token=access_token, token_type="bearer", refresh_token=secrets.token_hex(32))
    session.add(tokens)
    session.commit()
    session.refresh(tokens)
    return tokens

def register_credentials(register_request: RegisterRequest, session: Session) -> RegisterResponse:
    entity = session.exec(select(Credentials).where(Credentials.username == register_request.username)).first()
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
        session.commit()
        session.refresh(credentials)
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already exists"
        )
    return RegisterResponse(username=credentials.username)