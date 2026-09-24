from datetime import datetime, timedelta, timezone

from app.models import FriendRequest
from app.utils import overlaps, get_friend_ids
from conftest import make_user


def test_real_overlap_is_detected():
    start = datetime(2026, 1, 1, 18, 0, tzinfo=timezone.utc)
    assert overlaps(
        start, start + timedelta(hours=1),
        start + timedelta(hours=2), start + timedelta(hours=3),
    ) is True


def test_overlap_shorter_than_30_minutes_is_rejected():
    start = datetime(2026, 1, 1, 18, 0, tzinfo=timezone.utc)
    assert overlaps(
        start, start + timedelta(minutes=15),
        start + timedelta(minutes=30), start + timedelta(hours=1),
    ) is False


def test_no_overlap_at_all_is_rejected():
    start = datetime(2026, 1, 1, 18, 0, tzinfo=timezone.utc)
    assert overlaps(
        start, start + timedelta(hours=5),
        start + timedelta(hours=1), start + timedelta(hours=6),
    ) is False


def test_mostly_elapsed_overlap_is_rejected_when_too_little_real_time_remains():
    # both windows start at 9am and the total overlap is 3+ hours long,
    # but "now" is 11:50am, leaving only 15 real minutes before it ends at 12:05pm
    start = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
    now = datetime(2026, 1, 1, 11, 50, tzinfo=timezone.utc)
    assert overlaps(
        start, start,
        start + timedelta(hours=3, minutes=5), start + timedelta(hours=10),
        now=now,
    ) is False


def test_overlap_with_enough_real_time_remaining_still_counts():
    start = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
    now = datetime(2026, 1, 1, 11, 0, tzinfo=timezone.utc)
    assert overlaps(
        start, start,
        start + timedelta(hours=3, minutes=5), start + timedelta(hours=10),
        now=now,
    ) is True


def test_get_friend_ids_finds_accepted_friend_from_either_side(db):
    alice = make_user(db, "alice@example.com", "alice")
    bob = make_user(db, "bob@example.com", "bob")
    db.add(FriendRequest(requester_id=alice.id, recipient_id=bob.id, status="accepted"))
    db.commit()

    assert get_friend_ids(alice.id, db) == [bob.id]
    assert get_friend_ids(bob.id, db) == [alice.id]


def test_get_friend_ids_ignores_pending_requests(db):
    alice = make_user(db, "alice@example.com", "alice")
    bob = make_user(db, "bob@example.com", "bob")
    db.add(FriendRequest(requester_id=alice.id, recipient_id=bob.id, status="pending"))
    db.commit()

    assert get_friend_ids(alice.id, db) == []
