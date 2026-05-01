from sqlalchemy import Column, Date, ForeignKey, Integer

from shared.database import Base


class UserLoginDay(Base):
    __tablename__ = "user_login_days"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    login_date = Column(Date, primary_key=True)
