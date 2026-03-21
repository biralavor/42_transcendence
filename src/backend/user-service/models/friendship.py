from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.sql import func

from shared.database import Base


class Friendship(Base):
    __tablename__ = "friendships"
    __table_args__ = (
        UniqueConstraint("requester_id", "addressee_id", name="uq_friendship_pair"),
        CheckConstraint("status IN ('pending', 'accepted')", name='ck_friendships_status'),
    )

    id           = Column(Integer, primary_key=True)
    requester_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    addressee_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status       = Column(String(20), nullable=False, server_default="pending")
    created_at   = Column(TIMESTAMP, nullable=False, server_default=func.now())
