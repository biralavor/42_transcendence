from fastapi import FastAPI, status
from models.credentials import Credentials
from models.login import Login
from models.token import Token

app = FastAPI(title="Transcendence API")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "Transcendence API stub"}

@app.post("/test")
def test():
    return {"message": "Post test"}

@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(credentials: Credentials):
    return credentials

@app.post("/auth/login", status_code=status.HTTP_200_OK)
def login(login: Login):
    external_data = {
    'access_token': "token1"
    }
    token = Token(**external_data)
    return token