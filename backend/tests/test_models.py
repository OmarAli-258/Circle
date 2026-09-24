from datetime import datetime, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import User, FriendRequest, OutingInvite, Outing
from conftest import make_user


def test_display_name_falls_back_to_email_when_no_username():
    user = User(email="old@example.com", username=None, hashed_password="x")
    assert user.display_name == "old@example.com"


def test_display_name_uses_username_when_set():
    user = User(email="new@example.com", username="cooluser", hashed_password="x")
    assert user.display_name == "cooluser"


def test_database_rejects_duplicate_active_friendship_even_bypassing_app_checks(db):
    # this goes straight through SQLAlchemy, skipping the app-level duplicate
    # check in main.py entirely - proving the *database* is what actually
    # enforces this, not just a check that a fast enough race could slip past
    alice = make_user(db, "alice@example.com", "alice")
    bob = make_user(db, "bob@example.com", "bob")
    db.add(FriendRequest(requester_id=alice.id, recipient_id=bob.id, status="pending"))
    db.commit()

    # same pair, opposite direction - the app-level check looks both ways,
    # but this proves the low/high-ordered index catches it regardless
    db.add(FriendRequest(requester_id=bob.id, recipient_id=alice.id, status="pending"))
    with pytest.raises(IntegrityError):
        db.commit()


def test_declined_request_does_not_block_a_fresh_one(db):
    # the partial index only covers pending/accepted rows on purpose - a
    # declined (or removed) relationship should never permanently lock out
    # a future request between the same two people
    alice = make_user(db, "alice@example.com", "alice")
    bob = make_user(db, "bob@example.com", "bob")
    db.add(FriendRequest(requester_id=alice.id, recipient_id=bob.id, status="declined"))
    db.commit()

    db.add(FriendRequest(requester_id=alice.id, recipient_id=bob.id, status="pending"))
    db.commit()  # should not raise


def test_database_rejects_duplicate_invite_for_same_person_same_outing(db):
    alice = make_user(db, "alice@example.com", "alice")
    bob = make_user(db, "bob@example.com", "bob")
    outing = Outing(
        creator_id=alice.id, title="Coffee", location="Cafe",
        proposed_time=datetime(2026, 1, 1, 18, 0, tzinfo=timezone.utc),
    )
    db.add(outing)
    db.commit()

    db.add(OutingInvite(outing_id=outing.id, invitee_id=bob.id, status="pending"))
    db.commit()

    db.add(OutingInvite(outing_id=outing.id, invitee_id=bob.id, status="pending"))
    with pytest.raises(IntegrityError):
        db.commit()
