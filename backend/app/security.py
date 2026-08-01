import bcrypt
import jwt
from app.config import settings
from app.database import get_db
from app.models import User
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session


def hash_password(password):
    password=password.encode()
    salt=bcrypt.gensalt()
    hash=bcrypt.hashpw(password, salt)
    return hash.decode()
def verify_password(password,hash):
    return bcrypt.checkpw(password.encode(),hash.encode())    

def create_access_token(user_id):
    expire=datetime.now(timezone.utc) + timedelta(minutes=30)
    payload={"sub": str(user_id), "exp" : expire}
    return jwt.encode(payload,settings.jwt_secret,algorithm="HS256")

security = HTTPBearer()
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token=credentials.credentials
    try:
        payload = jwt.decode(token,settings.jwt_secret,algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="invalid or expired token")
    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(status_code=401, detail="user not found")
    return user 