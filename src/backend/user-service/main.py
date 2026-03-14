from fastapi import FastAPI, status
from service.schemas import Login, RegisterRequest
from service.service import register_user, authenticate

app = FastAPI(title="User Service")


@app.get("/health")
def health():
    return {"status": "ok", "service": "user-service"}

@app.get("/")
def root():
    return {"message": "User Service"}

@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(register_request: RegisterRequest):
    return register_user(register_request)

@app.post("/auth/login", status_code=status.HTTP_200_OK)
def login(login: Login):
    return authenticate(login)
