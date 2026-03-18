from typing import Annotated
from sqlmodel import Field, Session, SQLModel, create_engine, select

from fastapi import FastAPI, status, Depends
from service.schemas import Login, RegisterRequest, Credentials
from service.service import authenticate, register_credentials

sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

engine = create_engine(sqlite_url, echo=True)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

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

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
def create_credentials(register_request: RegisterRequest, session: SessionDependency):
    return register_credentials(register_request, session)
