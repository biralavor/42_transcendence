from sqlalchemy import Column, ForeignKey, Integer, String

from shared.database import Base


class Credentials(Base):
    __tablename__ = "credentials"

    id = Column(Integer, primary_key=True)
    username = Column(String, nullable=False, unique=True)
    password = Column(String, nullable=False)


class Tokens(Base):
    __tablename__ = "tokens"

    id = Column(Integer, primary_key=True)
    credential_id = Column(Integer, ForeignKey("credentials.id"), nullable=False)
    access_token = Column(String, nullable=False)
    token_type = Column(String, nullable=False)
    refresh_token = Column(String, nullable=False)
