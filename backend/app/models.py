from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, ForeignKey, DateTime, Index, UniqueConstraint, event, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

from app.database import Base


class UTCDateTime(TypeDecorator):
    """Same on-the-wire column type as DateTime(timezone=True) (no change for
    Postgres, which already round-trips aware datetimes correctly) - but also
    re-attaches UTC on read when the underlying driver returns a naive value,
    which SQLite does (it has no real timezone-aware storage). Only matters
    for tests; a no-op against the real Postgres database."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value

class User(Base):
    __tablename__ ="users"
    id: Mapped[int]= mapped_column(primary_key=True)
    email : Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    username : Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True)
    hashed_password : Mapped[str] = mapped_column()
    created_at : Mapped[datetime] = mapped_column(default = lambda: datetime.now(timezone.utc))

    @property
    def display_name(self):
        return self.username or self.email
class FriendRequest(Base):
    __tablename__= "friend_requests"
    id : Mapped[int] = mapped_column(primary_key=True)
    requester_id : Mapped[int] = mapped_column(ForeignKey("users.id"))
    recipient_id : Mapped[int] = mapped_column(ForeignKey("users.id"))
    # order-independent copy of the pair (min/max of the two ids), auto-filled
    # by the before_insert hook below - lets the database itself enforce "at
    # most one active (pending/accepted) relationship per pair", regardless
    # of which direction it was requested in. An application-level check
    # alone can't prevent two simultaneous requests from both slipping past
    # it before either commits; this constraint is the real backstop.
    low_user_id : Mapped[int] = mapped_column(default=0)
    high_user_id : Mapped[int] = mapped_column(default=0)
    status : Mapped[str] = mapped_column(String(20),default="pending")
    created_at : Mapped[datetime] = mapped_column(default = lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index(
            "uq_one_active_friendship_per_pair",
            "low_user_id", "high_user_id",
            unique=True,
            postgresql_where=text("status IN ('pending', 'accepted')"),
            sqlite_where=text("status IN ('pending', 'accepted')"),
        ),
    )


@event.listens_for(FriendRequest, "before_insert")
def _set_ordered_pair(mapper, connection, target):
    target.low_user_id = min(target.requester_id, target.recipient_id)
    target.high_user_id = max(target.requester_id, target.recipient_id)

class Availability(Base):
    __tablename__= "availability"
    id : Mapped[int] = mapped_column(primary_key=True)
    user_id : Mapped[int] = mapped_column(ForeignKey("users.id"))
    start_time : Mapped[datetime] = mapped_column(UTCDateTime)
    end_time : Mapped[datetime] = mapped_column(UTCDateTime)
    created_at : Mapped[datetime] = mapped_column(default= lambda: datetime.now(timezone.utc))

class Outing(Base):
    __tablename__= "outings"
    id : Mapped[int] = mapped_column(primary_key=True)
    creator_id : Mapped[int] = mapped_column(ForeignKey("users.id")) 
    title : Mapped[str] = mapped_column()
    proposed_time : Mapped[datetime] = mapped_column(UTCDateTime)
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

    __table_args__ = (
        UniqueConstraint("outing_id", "invitee_id", name="uq_one_invite_per_person_per_outing"),
    )