from datetime import timedelta

from app.models import FriendRequest


def overlaps(start_a, start_b, end_a, end_b):
    overlap_start=max(start_a,start_b)
    overlap_end=min(end_a,end_b)
    overlap=(overlap_end-overlap_start)
    return overlap>= timedelta(minutes=30)

def get_friend_ids(user_id, db):
    accepted_friends = db.query(FriendRequest).filter(
        (FriendRequest.recipient_id == user_id) | (FriendRequest.requester_id == user_id),
        FriendRequest.status == "accepted"
    ).all()
    return [req.recipient_id if user_id == req.requester_id else req.requester_id for req in accepted_friends]