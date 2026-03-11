from sqlalchemy import Column, Integer, String, TIMESTAMP
from sqlalchemy.sql import func

from shared.database import Base


class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    id = Column(Integer, primary_key=True)
    room_name = Column(String(100))
    room_type = Column(String(20))
    created_at = Column(TIMESTAMP, default=func.now())
