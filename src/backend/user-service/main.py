from typing import Annotated
from sqlmodel import Session, create_engine

from fastapi import FastAPI, status, Depends
from service.schemas import Login, RegisterRequest
from service.service import authenticate, register_credentials
from shared.config.settings import settings

DATABASE_URL = (
    f"postgresql+psycopg2://{settings.DB_USER}:{settings.DB_PASSWORD}"
    f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
)

engine = create_engine(DATABASE_URL, echo=settings.DB_ECHO)

def get_session():
    with Session(engine) as session:
        yield session

SessionDependency = Annotated[Session, Depends(get_session)]

app = FastAPI(title="User Service")

@app.get("/health")
def health():
    return {"status": "ok", "service": "user-service"}

@app.get("/")
def root():
    return {"message": "User Service"}

@app.post("/auth/login", status_code=status.HTTP_200_OK)
def login(login: Login, session: SessionDependency):
    return authenticate(login, session)

@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
def create_credentials(register_request: RegisterRequest, session: SessionDependency):
    return register_credentials(register_request, session)
