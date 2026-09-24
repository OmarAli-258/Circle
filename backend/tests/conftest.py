import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app import models  # noqa: F401 - registers models on Base.metadata
from app.models import User


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


def make_user(db, email, username):
    user = User(email=email, username=username, hashed_password="not-a-real-hash")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
