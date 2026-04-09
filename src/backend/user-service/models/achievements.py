from sqlalchemy import (
    Column,
    Computed,
    ForeignKey,
    Integer,
    PrimaryKeyConstraint,
    String,
    TIMESTAMP,
    Text
)
from sqlalchemy.sql import func

from shared.database import Base


class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(Integer, primary_key=True)
    key = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    icon = Column(String(100), nullable=True)

    def __repr__(self):
        return f"<Achievement(key='{self.key}', name='{self.name}')>"


class UserAchievement(Base):
    __tablename__ = "user_achievements"

    user_id = Column(Integer,
                     ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False)

    achievement_id = Column(Integer,
                            ForeignKey("achievements.id"),
                            nullable=False)

    earned_at = Column(TIMESTAMP(timezone=True),
                       nullable=False,
                       server_default=func.now())

    __table_args__ = (
        PrimaryKeyConstraint("user_id", "achievement_id"),
    )

    def __repr__(self):
        return f"<UserAchievement(user_id={self.user_id}, \
        achievement_id={self.achievement_id})>"


class UserXP(Base):
    __tablename__ = "user_xp"

    user_id = Column(Integer,
                     ForeignKey("users.id", ondelete="CASCADE"),
                     primary_key=True)
    xp = Column(Integer, default=0)
    level = Column(Integer, Computed('xp / 100 + 1'))

    def __repr__(self):
        return f"<UserXP(user_id={self.user_id},\
        xp={self.xp},\
        level={self.level})>"
