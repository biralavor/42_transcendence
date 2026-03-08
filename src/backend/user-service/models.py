from pydantic import BaseModel


class Credentials(BaseModel):
    username: str
    email: str
    password: bytes

class Login(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str