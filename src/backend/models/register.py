from pydantic import BaseModel

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str