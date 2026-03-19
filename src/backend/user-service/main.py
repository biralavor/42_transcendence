from typing import Annotated

from fastapi import FastAPI, status, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from service.schemas import Login, LoginResponse, RegisterRequest, RegisterResponse, ProfileResponse, UpdateProfileRequest
from service.service import authenticate, register_credentials, get_profile, update_profile
from shared.database import get_db

SessionDependency = Annotated[AsyncSession, Depends(get_db)]

app = FastAPI(title="User Service")


@app.get("/health")
def health():
    return {"status": "ok", "service": "user-service"}


@app.get("/")
def root():
    return {"message": "User Service"}


@app.post("/auth/login", status_code=status.HTTP_200_OK, response_model=LoginResponse)
async def login(login: Login, session: SessionDependency):
    return await authenticate(login, session)


@app.post("/auth/register", status_code=status.HTTP_201_CREATED, response_model=RegisterResponse)
async def create_credentials(register_request: RegisterRequest, session: SessionDependency):
    return await register_credentials(register_request, session)


@app.get("/profile/{user_id}", response_model=ProfileResponse)
async def get_user_profile(user_id: int, session: SessionDependency):
    profile = await get_profile(user_id, session)
    if profile is None:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


@app.put("/profile/{user_id}", response_model=ProfileResponse)
async def update_user_profile(
    user_id: int, data: UpdateProfileRequest, session: SessionDependency
):
    profile = await update_profile(user_id, data, session)
    if profile is None:
        raise HTTPException(status_code=404, detail="User not found")
    return profile
