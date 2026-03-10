from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from shared.config.settings import settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=settings.DB_ECHO)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
