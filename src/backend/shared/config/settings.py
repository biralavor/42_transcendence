import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DB_HOST: str = "db"
    DB_PORT: int = 5432
    DB_NAME: str = "transcendence_db"
    DB_ECHO: bool = False
    JWT_SECRET_KEY: str = "changeme"
    USER_SERVICE_PORT: int = 8001
    USER_SERVICE_URL: str = ""

    def __init__(self, **data):
        super().__init__(**data)
        # Derive USER_SERVICE_URL from USER_SERVICE_PORT if not explicitly set
        if not self.USER_SERVICE_URL:
            self.USER_SERVICE_URL = f"http://user-service:{self.USER_SERVICE_PORT}"

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
