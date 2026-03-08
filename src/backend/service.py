from fastapi import FastAPI, status, HTTPException
from models.credentials import Credentials
from models.login import Login
from models.token import Token
from models.register import RegisterRequest
import bcrypt

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
    external_data = {
    'access_token': "Success"
    }
    password_bytes = login.password.encode('utf-8')
    user = find_user_by_name(login.username, database)
    is_authenticated = (user is not None 
        and login.username == user.username 
        and bcrypt.checkpw(password_bytes, user.password))
    if (is_authenticated):
        token = Token(**external_data)
        return token
    raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
    )

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