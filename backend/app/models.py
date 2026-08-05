from datetime import datetime, timezone
from typing import Optional
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

class Availability(Base):
    __tablename__= "availability"
    id : Mapped[int] = mapped_column(primary_key=True)
    user_id : Mapped[int] = mapped_column(ForeignKey("users.id"))
    start_time : Mapped[datetime] = mapped_column()
    end_time : Mapped[datetime] = mapped_column()
    created_at : Mapped[datetime] = mapped_column(default= lambda: datetime.now(timezone.utc))

class Outing(Base):
    __tablename__= "outings"
    id : Mapped[int] = mapped_column(primary_key=True)
    creator_id : Mapped[int] = mapped_column(ForeignKey("users.id")) 
    title : Mapped[str] = mapped_column()
    proposed_time : Mapped[datetime] = mapped_column() 
    location : Mapped[str] = mapped_column()
    status : Mapped[str] = mapped_column(default = "open")
    cancellation_message : Mapped[Optional[str]] = mapped_column(nullable=True) 
    created_at : Mapped[datetime] = mapped_column(default= lambda : datetime.now(timezone.utc))

class OutingInvite(Base):
    __tablename__="outing_invites"
    id : Mapped[int] = mapped_column(primary_key=True)
    outing_id : Mapped[int] = mapped_column(ForeignKey("outings.id"))
    invitee_id : Mapped[int] = mapped_column(ForeignKey("users.id"))
    status : Mapped[str] = mapped_column(default = "pending")
    responded_at : Mapped[Optional[datetime]] = mapped_column(nullable=True)