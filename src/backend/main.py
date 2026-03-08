from fastapi import FastAPI, status, HTTPException
from models.credentials import Credentials
from models.login import Login
from models.token import Token
from models.register import RegisterRequest
from service import *

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
def register(register_request: RegisterRequest):
    return register_user(register_request)

@app.post("/auth/login", status_code=status.HTTP_200_OK)
def login(login: Login):
    return authenticate(login)