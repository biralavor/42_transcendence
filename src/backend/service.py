from fastapi import FastAPI, status, HTTPException
from models.credentials import Credentials
from models.login import Login
from models.token import Token

def hash_password(password: str) -> str:
    return password + "salt"

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
    user = find_user_by_name(login.username, database)
    is_authenticated = (user is not None 
        and login.username == user.username 
        and hash_password(login.password) == user.password)
    if (is_authenticated):
        token = Token(**external_data)
        return token
    raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
    )

def register_user(credentials: Credentials):
    if find_user_by_name(credentials.username, database) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already exists"
        )
    credentials.password = hash_password(credentials.password)
    database.append(credentials)
    print(database)
    return { "username": credentials.username }