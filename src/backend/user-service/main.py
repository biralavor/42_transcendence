from typing import Annotated

from fastapi import FastAPI, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from service.schemas import Login, RegisterRequest
from service.service import authenticate, register_credentials
from shared.database import get_db

SessionDependency = Annotated[AsyncSession, Depends(get_db)]

app = FastAPI(title="User Service")


@app.get("/health")
def health():
    return {"status": "ok", "service": "user-service"}


@app.get("/")
def root():
    return {"message": "User Service"}


@app.post("/auth/login", status_code=status.HTTP_200_OK)
async def login(login: Login, session: SessionDependency):
    return await authenticate(login, session)


@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
async def create_credentials(register_request: RegisterRequest, session: SessionDependency):
    return await register_credentials(register_request, session)
