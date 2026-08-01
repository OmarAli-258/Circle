from fastapi import Depends, FastAPI, HTTPException
from app.models import User
from app.schemas import UserCreate, UserOut, UserLogin, Token
from app.security import hash_password, verify_password, create_access_token, get_current_user
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.database import get_db

app = FastAPI(title="Circle API")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/db")
def health_db(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}

@app.post("/signup",response_model=UserOut)
def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="email already registered")
    new_user = User(
        email=user_data.email,
        hashed_password=hash_password(user_data.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/login",response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user=db.query(User).filter(User.email == user_data.email).first()
    if not user or not verify_password(user_data.password,user.hashed_password):
        raise HTTPException(status_code=401, detail="incorrect email or password")
    token = create_access_token(user.id)
    return Token(access_token=token)
@app.get("/me",response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user