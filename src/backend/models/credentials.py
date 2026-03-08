from pydantic import BaseModel


class Credentials(BaseModel):
    username: str
    email: str
    password: str