from datetime import datetime, timezone
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.models import User, FriendRequest, Availability, Outing, OutingInvite
from app.schemas import UserCreate, UserOut, UserLogin, Token, FriendRequestOut, FriendRequestCreate, AvailabilityCreate, AvailabilityOut, OutingCreate, OutingOut,OutingInviteOut
from app.security import hash_password, verify_password, create_access_token, get_current_user
from app.utils import get_friend_ids, overlaps
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.database import get_db

app = FastAPI(title="Circle API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.post("/friend_requests", response_model=FriendRequestOut)
def send_friend_request(request_data :FriendRequestCreate, current_user : User = Depends(get_current_user), db : Session = Depends(get_db)):
    recipient = db.query(User).filter(User.email == request_data.recipient_email).first()
    if request_data.recipient_email == current_user.email:
        raise HTTPException(status_code= 400, detail="cannot send friend request to yourself")
    if not recipient:
        raise HTTPException(status_code=404, detail="user not found")
    new_request= FriendRequest(
        requester_id=current_user.id,
        recipient_id=recipient.id,
        status="pending",
    )
    db.add(new_request)
    db.commit()
    db.refresh(new_request)
    return FriendRequestOut(
        id=new_request.id,
        requester_id=new_request.requester_id,
        requester_email=current_user.email,
        recipient_id=new_request.recipient_id,
        status=new_request.status,
        created_at=new_request.created_at,
    )
@app.post("/friend_requests/{request_id}/accept", response_model=FriendRequestOut)
def accept_friend_request(request_id: int, current_user : User = Depends(get_current_user), db : Session = Depends(get_db)):
    friend_request=db.query(FriendRequest).filter(FriendRequest.id == request_id).first()
    if not friend_request:
        raise HTTPException(status_code=404, detail="friend request not found")
    if friend_request.recipient_id != current_user.id:
        raise HTTPException(status_code =403, detail="wrong user to accept ")
    if friend_request.status != "pending":
        raise HTTPException(status_code= 400, detail="request not pending")
    friend_request.status = "accepted"
    db.commit()
    db.refresh(friend_request)
    requester = db.query(User).filter(User.id == friend_request.requester_id).first()
    return FriendRequestOut(
        id=friend_request.id,
        requester_id=friend_request.requester_id,
        requester_email=requester.email,
        recipient_id=friend_request.recipient_id,
        status=friend_request.status,
        created_at=friend_request.created_at,
    )
@app.post("/friend_requests/{request_id}/decline", response_model=FriendRequestOut)
def decline_friend_request(request_id: int, current_user : User = Depends(get_current_user), db : Session = Depends(get_db)):
    friend_request=db.query(FriendRequest).filter(FriendRequest.id == request_id).first()
    if not friend_request:
        raise HTTPException(status_code=404, detail="friend request not found")
    if friend_request.recipient_id != current_user.id:
        raise HTTPException(status_code =403, detail="wrong user to decline ")
    if friend_request.status != "pending":
        raise HTTPException(status_code= 400, detail="request not pending")
    friend_request.status = "declined"
    db.commit()
    db.refresh(friend_request)
    requester = db.query(User).filter(User.id == friend_request.requester_id).first()
    return FriendRequestOut(
        id=friend_request.id,
        requester_id=friend_request.requester_id,
        requester_email=requester.email,
        recipient_id=friend_request.recipient_id,
        status=friend_request.status,
        created_at=friend_request.created_at,
    )
@app.get("/friends",response_model=list[UserOut])
def list_friends(current_user : User = Depends(get_current_user),db : Session = Depends(get_db)):
    friend_ids = get_friend_ids(current_user.id, db)
    friends=db.query(User).filter(User.id.in_(friend_ids)).all()
    return friends

@app.post("/availability", response_model=AvailabilityOut)
def create_availability(availability_data: AvailabilityCreate, current_user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    if availability_data.end_time <= availability_data.start_time:
        raise HTTPException(status_code=400, detail="end time must be after start")
    new_availability = Availability(user_id=current_user.id, start_time=availability_data.start_time,
                                    end_time=availability_data.end_time)
    db.add(new_availability)
    db.commit()
    db.refresh(new_availability)
    return new_availability

@app.get("/availability/matches", response_model=list[UserOut])
def get_availability_matches(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    friend_ids = get_friend_ids(current_user.id, db)
    my_windows= db.query(Availability).filter(Availability.user_id == current_user.id).all()
    friend_windows= db.query(Availability).filter(Availability.user_id.in_(friend_ids)).all()
    matched_user_ids=[]
    for my_window in my_windows:
        for friend_window in friend_windows:
            if overlaps(my_window.start_time,friend_window.start_time,my_window.end_time,friend_window.end_time):
                if friend_window.user_id not in matched_user_ids:
                    matched_user_ids.append(friend_window.user_id)
    matches= db.query(User).filter(User.id.in_(matched_user_ids)).all()
    return matches

@app.post("/outings",response_model=OutingOut)
def create_outings(outing_data : OutingCreate, current_user : User = Depends(get_current_user), db : Session = Depends(get_db)):
    friend_ids = get_friend_ids(current_user.id, db)
    for invitee_id in outing_data.invitee_ids:
        if invitee_id not in friend_ids:
            raise HTTPException(status_code=400, detail="invitee is not a friend")
    new_outing = Outing(
        creator_id = current_user.id,
        title = outing_data.title,
        proposed_time = outing_data.proposed_time,
        location= outing_data.location,
        status = "open"
    )
    db.add(new_outing)
    db.commit()
    db.refresh(new_outing)
    for invitee_id in outing_data.invitee_ids:
        invite = OutingInvite(outing_id=new_outing.id, invitee_id=invitee_id, status= "pending")
        db.add(invite)
    db.commit()
    return new_outing  

@app.post("/outing_invites/{invite_id}/accept", response_model=OutingInviteOut)
def accept_outing_invite(invite_id : int ,current_user : User = Depends(get_current_user) , db : Session = Depends(get_db)):
    outinginvite = db.query(OutingInvite).filter(OutingInvite.id == invite_id).first()
    if not outinginvite:
        raise HTTPException(status_code=404, detail="no invitation found")
    if outinginvite.invitee_id != current_user.id:
        raise HTTPException(status_code=403, detail= "user is not invitee")
    if outinginvite.status != "pending":
        raise HTTPException(status_code=400, detail= "already responded to")
    outinginvite.status="accepted"
    outinginvite.responded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(outinginvite)
    return outinginvite

@app.post("/outing_invites/{invite_id}/decline",response_model=OutingInviteOut)
def decline_outing_invite(invite_id : int ,current_user : User = Depends(get_current_user) , db : Session = Depends(get_db)):
    outinginvite = db.query(OutingInvite).filter(OutingInvite.id == invite_id).first()
    if not outinginvite:
        raise HTTPException(status_code=404, detail="no invitation found")
    if outinginvite.invitee_id != current_user.id:
        raise HTTPException(status_code=403, detail= "user is not invitee")
    if outinginvite.status != "pending":
        raise HTTPException(status_code=400, detail= "already responded to")
    outinginvite.status="declined"
    outinginvite.responded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(outinginvite)
    return outinginvite
@app.get("/friend_requests/pending",response_model=list[FriendRequestOut])
def my_friend_requests(current_user : User = Depends(get_current_user), db : Session = Depends(get_db)):
    recieved_requests=db.query(FriendRequest).filter(current_user.id== FriendRequest.recipient_id,
                                                     FriendRequest.status== "pending").all()
    result = []
    for request in recieved_requests:
        requester = db.query(User).filter(User.id == request.requester_id).first()
        result.append(FriendRequestOut(
            id=request.id,
            requester_id=request.requester_id,
            requester_email=requester.email,
            recipient_id=request.recipient_id,
            status=request.status,
            created_at=request.created_at,
        ))
    return result
