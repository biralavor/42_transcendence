from sqlalchemy import Column, Integer, TIMESTAMP, UniqueConstraint
from sqlalchemy.sql import func

from shared.database import Base


class Block(Base):
    __tablename__ = "blocks"
    __table_args__ = (
        UniqueConstraint("blocker_id", "blocked_id", name="uq_blocks_pair"),
    )

    id = Column(Integer, primary_key=True)
    blocker_id = Column(Integer, nullable=False, index=True)
    blocked_id = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
