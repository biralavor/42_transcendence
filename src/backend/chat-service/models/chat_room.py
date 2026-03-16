from sqlalchemy import Column, Integer, String, TIMESTAMP, UniqueConstraint
from sqlalchemy.sql import func

from shared.database import Base


class ChatRoom(Base):
    __tablename__ = "chat_rooms"
    __table_args__ = (UniqueConstraint("room_name", name="uq_chat_rooms_room_name"),)

    id = Column(Integer, primary_key=True)
    room_name = Column(String(100), nullable=False)
    room_type = Column(String(20))
    created_at = Column(TIMESTAMP, server_default=func.now())
