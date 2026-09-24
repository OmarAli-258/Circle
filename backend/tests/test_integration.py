from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(bind=engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def fresh_database():
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


def signup_and_login(email, username, password="testpass123"):
    signup = client.post("/signup", json={"email": email, "username": username, "password": password})
    assert signup.status_code == 200, signup.text
    login = client.post("/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, signup.json()["id"]


def become_friends(alice_headers, bob_headers, bob_email):
    resp = client.post("/friend_requests", json={"recipient_email": bob_email}, headers=alice_headers)
    assert resp.status_code == 200, resp.text
    request_id = resp.json()["id"]
    resp = client.post(f"/friend_requests/{request_id}/accept", headers=bob_headers)
    assert resp.status_code == 200, resp.text
    return request_id


def test_full_two_person_journey():
    alice_headers, alice_id = signup_and_login("alice@example.com", "alice")
    bob_headers, bob_id = signup_and_login("bob@example.com", "bob")

    # not friends yet - no matches, no friends list entries
    assert client.get("/friends", headers=alice_headers).json() == []

    become_friends(alice_headers, bob_headers, "bob@example.com")

    friends = client.get("/friends", headers=alice_headers).json()
    assert any(f["email"] == "bob@example.com" for f in friends)

    # overlapping availability -> a real match
    now = datetime.now(timezone.utc)
    start = now + timedelta(hours=1)
    client.post("/availability", json={
        "start_time": start.isoformat(), "end_time": (start + timedelta(hours=2)).isoformat(),
    }, headers=alice_headers)
    client.post("/availability", json={
        "start_time": (start + timedelta(hours=1)).isoformat(), "end_time": (start + timedelta(hours=3)).isoformat(),
    }, headers=bob_headers)

    matches = client.get("/availability/matches", headers=alice_headers).json()
    assert any(m["email"] == "bob@example.com" for m in matches)

    # alice creates an outing inviting bob
    resp = client.post("/outings", json={
        "title": "Coffee", "location": "Cafe",
        "proposed_time": (now + timedelta(days=1)).isoformat(), "invitee_ids": [bob_id],
    }, headers=alice_headers)
    assert resp.status_code == 200, resp.text
    outing_id = resp.json()["id"]

    # bob sees and accepts the invite
    pending = client.get("/outing_invites/pending", headers=bob_headers).json()
    invite_id = next(i["id"] for i in pending if i["outing_id"] == outing_id)
    resp = client.post(f"/outing_invites/{invite_id}/accept", headers=bob_headers)
    assert resp.status_code == 200, resp.text

    # both now see it as a current outing
    alice_current = client.get("/outings/current", headers=alice_headers).json()
    bob_current = client.get("/outings/current", headers=bob_headers).json()
    assert any(o["id"] == outing_id for o in alice_current)
    assert any(o["id"] == outing_id for o in bob_current)

    # bob leaves - vanishes from his view, stays for alice
    resp = client.post(f"/outings/{outing_id}/leave", headers=bob_headers)
    assert resp.status_code == 200, resp.text
    assert not any(o["id"] == outing_id for o in client.get("/outings/current", headers=bob_headers).json())
    assert any(o["id"] == outing_id for o in client.get("/outings/current", headers=alice_headers).json())

    # alice deletes it entirely - gone for everyone
    resp = client.post(f"/outings/{outing_id}/delete", headers=alice_headers)
    assert resp.status_code == 200, resp.text
    assert not any(o["id"] == outing_id for o in client.get("/outings/current", headers=alice_headers).json())


def test_cannot_accept_a_friend_request_addressed_to_someone_else():
    alice_headers, _ = signup_and_login("alice@example.com", "alice")
    bob_headers, _ = signup_and_login("bob@example.com", "bob")
    carol_headers, _ = signup_and_login("carol@example.com", "carol")

    resp = client.post("/friend_requests", json={"recipient_email": "bob@example.com"}, headers=alice_headers)
    request_id = resp.json()["id"]

    resp = client.post(f"/friend_requests/{request_id}/accept", headers=carol_headers)
    assert resp.status_code == 403


def test_only_the_creator_can_delete_an_outing():
    alice_headers, _ = signup_and_login("alice@example.com", "alice")
    bob_headers, bob_id = signup_and_login("bob@example.com", "bob")
    become_friends(alice_headers, bob_headers, "bob@example.com")

    resp = client.post("/outings", json={
        "title": "Coffee", "location": "Cafe",
        "proposed_time": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "invitee_ids": [bob_id],
    }, headers=alice_headers)
    outing_id = resp.json()["id"]

    resp = client.post(f"/outings/{outing_id}/delete", headers=bob_headers)
    assert resp.status_code == 403


def test_cancelled_outing_invite_cannot_be_accepted():
    alice_headers, _ = signup_and_login("alice@example.com", "alice")
    bob_headers, bob_id = signup_and_login("bob@example.com", "bob")
    become_friends(alice_headers, bob_headers, "bob@example.com")

    resp = client.post("/outings", json={
        "title": "Coffee", "location": "Cafe",
        "proposed_time": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "invitee_ids": [bob_id],
    }, headers=alice_headers)
    outing_id = resp.json()["id"]

    invite_id = next(
        i["id"] for i in client.get("/outing_invites/pending", headers=bob_headers).json()
        if i["outing_id"] == outing_id
    )

    client.post(f"/outings/{outing_id}/delete", headers=alice_headers)

    # gone from the pending list entirely once cancelled
    pending = client.get("/outing_invites/pending", headers=bob_headers).json()
    assert not any(i["id"] == invite_id for i in pending)

    # and directly accepting it anyway is rejected
    resp = client.post(f"/outing_invites/{invite_id}/accept", headers=bob_headers)
    assert resp.status_code == 400


def test_duplicate_friend_request_is_rejected():
    alice_headers, _ = signup_and_login("alice@example.com", "alice")
    _, bob_id = signup_and_login("bob@example.com", "bob")

    first = client.post("/friend_requests", json={"recipient_email": "bob@example.com"}, headers=alice_headers)
    assert first.status_code == 200

    second = client.post("/friend_requests", json={"recipient_email": "bob@example.com"}, headers=alice_headers)
    assert second.status_code == 400
