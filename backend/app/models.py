from datetime import datetime, timezone
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base 
class User(Base):
    __tablename__ ="users"
    id: Mapped[int]= mapped_column(primary_key=True)
    email : Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password : Mapped[str] = mapped_column()
    created_at : Mapped[datetime] = mapped_column(default = lambda: datetime.now(timezone.utc))
class FriendRequest(Base):
    __tablename__= "friend_requests"
    id : Mapped[int] = mapped_column(primary_key=True)
    requester_id : Mapped[int] = mapped_column(ForeignKey("users.id"))
    recipient_id : Mapped[int] = mapped_column(ForeignKey("users.id"))
    status : Mapped[str] = mapped_column(String(20),default="pending")
    created_at : Mapped[datetime] = mapped_column(default = lambda: datetime.now(timezone.utc))