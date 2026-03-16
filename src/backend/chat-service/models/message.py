from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func

from shared.database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True)
    room_id = Column(Integer, ForeignKey("chat_rooms.id"))
    # Cross-service reference stored as plain integer (no ORM-level FK)
    user_id = Column(Integer, nullable=True)
    content = Column(Text, nullable=False)
    sender_name = Column(String(50), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
