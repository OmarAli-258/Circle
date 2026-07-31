import bcrypt 
import jwt
from app.config import settings
from datetime import datetime, timedelta, timezone
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