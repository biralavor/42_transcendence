from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, CheckConstraint, Index, text
from sqlalchemy.sql import func

from shared.database import Base


class Friendship(Base):
    __tablename__ = "friendships"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'accepted')", name='ck_friendships_status'),
        # Canonical unique index: enforces one row per pair regardless of direction
        # (LEAST/GREATEST normalises (A,B) and (B,A) to the same key)
        Index(
            'uq_friendship_canonical',
            text('LEAST(requester_id, addressee_id)'),
            text('GREATEST(requester_id, addressee_id)'),
            unique=True,
        ),
    )

    id           = Column(Integer, primary_key=True)
    requester_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    addressee_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status       = Column(String(20), nullable=False, server_default="pending")
    created_at   = Column(TIMESTAMP, nullable=False, server_default=func.now())
