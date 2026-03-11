from fastapi import status, HTTPException
from service.schemas import Credentials, Login, Token, RegisterRequest
from datetime import datetime, timedelta, timezone
import bcrypt
from jose import jwt

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

def create_database():
    user = {
        'username': "bruno",
        'email': "bruno@example.com",
        'password': hash_password("bruno123")
    }
    credentials = Credentials(**user) 
    database = [credentials]
    return database

database = create_database()

def find_user_by_name(username, database):
    for user in database:
        if user.username == username:
            return user
    return None

def authenticate(login: Login) -> Token:
    password_bytes = login.password.encode('utf-8')
    user = find_user_by_name(login.username, database)
    is_authenticated = (user is not None 
        and login.username == user.username 
        and bcrypt.checkpw(password_bytes, user.password))
    if (not is_authenticated):
        raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    token = Token(access_token=access_token, token_type="bearer")
    return token

def register_user(register_request: RegisterRequest):
    if find_user_by_name(register_request.username, database) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already exists"
        )
    credentials = Credentials(
        username=register_request.username,
        email=register_request.email,
        password=hash_password(register_request.password)
    )
    database.append(credentials)
    print(database)
    return { "username": credentials.username }