from app.models import User


def test_display_name_falls_back_to_email_when_no_username():
    user = User(email="old@example.com", username=None, hashed_password="x")
    assert user.display_name == "old@example.com"


def test_display_name_uses_username_when_set():
    user = User(email="new@example.com", username="cooluser", hashed_password="x")
    assert user.display_name == "cooluser"
