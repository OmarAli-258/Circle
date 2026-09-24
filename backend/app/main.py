from datetime import datetime, timezone
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.models import User, FriendRequest, Availability, Outing, OutingInvite
from app.schemas import UserCreate, UserOut, UserLogin, Token, FriendRequestOut, FriendRequestCreate, AvailabilityCreate, AvailabilityOut, OutingCreate, OutingOut,OutingInviteOut, CurrentOutingOut, MatchOut
from app.security import hash_password, verify_password, create_access_token, get_current_user
from app.utils import get_friend_ids, overlaps
from sqlalchemy import text, and_, or_
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
    existing_request = db.query(FriendRequest).filter(
        or_(
            and_(FriendRequest.requester_id == current_user.id, FriendRequest.recipient_id == recipient.id),
            and_(FriendRequest.requester_id == recipient.id, FriendRequest.recipient_id == current_user.id),
        ),
        FriendRequest.status.in_(["pending", "accepted"]),
    ).first()
    if existing_request:
        if existing_request.status == "accepted":
            raise HTTPException(status_code=400, detail="you are already friends")
        raise HTTPException(status_code=400, detail="friend request already pending")
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

@app.get("/availability/mine", response_model=list[AvailabilityOut])
def get_my_availability(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    return db.query(Availability).filter(
        Availability.user_id == current_user.id, Availability.end_time > now
    ).order_by(Availability.start_time).all()

@app.get("/availability/matches", response_model=list[MatchOut])
def get_availability_matches(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    friend_ids = get_friend_ids(current_user.id, db)
    now = datetime.now(timezone.utc)
    my_windows= db.query(Availability).filter(Availability.user_id == current_user.id, Availability.end_time > now).all()
    friend_windows= db.query(Availability).filter(Availability.user_id.in_(friend_ids), Availability.end_time > now).all()
    matched_overlaps = {}
    for my_window in my_windows:
        for friend_window in friend_windows:
            if overlaps(my_window.start_time,friend_window.start_time,my_window.end_time,friend_window.end_time):
                if friend_window.user_id not in matched_overlaps:
                    matched_overlaps[friend_window.user_id] = (
                        max(my_window.start_time, friend_window.start_time),
                        min(my_window.end_time, friend_window.end_time),
                    )
    result = []
    for friend_id, (overlap_start, overlap_end) in matched_overlaps.items():
        friend = db.query(User).filter(User.id == friend_id).first()
        result.append(MatchOut(
            id=friend.id,
            email=friend.email,
            created_at=friend.created_at,
            overlap_start=overlap_start,
            overlap_end=overlap_end,
        ))
    return result

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
    detail=db.query(Outing).filter(outinginvite.outing_id==Outing.id).first()
    outinginviteout=OutingInviteOut(
        id = outinginvite.id,
        outing_id = outinginvite.outing_id,
        invitee_id = outinginvite.invitee_id,
        status = outinginvite.status,
        outing_title = detail.title,
        outing_location = detail.location,
        outing_time = detail.proposed_time,
        responded_at = outinginvite.responded_at,
    )
    return outinginviteout

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
    detail=db.query(Outing).filter(outinginvite.outing_id==Outing.id).first()
    outinginviteout=OutingInviteOut(
        id = outinginvite.id,
        outing_id = outinginvite.outing_id,
        invitee_id = outinginvite.invitee_id,
        status = outinginvite.status,
        outing_title = detail.title,
        outing_location = detail.location,
        outing_time = detail.proposed_time,
        responded_at = outinginvite.responded_at,
    )
    return outinginviteout    
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
@app.get("/outing_invites/pending", response_model=list[OutingInviteOut])
def my_outing_invites(current_user : User = Depends(get_current_user), db : Session = Depends(get_db)):
    outing_invites=db.query(OutingInvite).filter(current_user.id ==OutingInvite.invitee_id, OutingInvite.status=="pending").all()
    result = []
    for invite in outing_invites:
        outing = db.query(Outing).filter(Outing.id == invite.outing_id).first()
        result.append(OutingInviteOut(
            id = invite.id,
            outing_id = invite.outing_id,
            invitee_id = invite.invitee_id,
            status = invite.status,
            outing_title = outing.title,
            outing_location = outing.location,
            outing_time = outing.proposed_time,
            responded_at = invite.responded_at,
        ))
    return result

@app.get("/outings/current", response_model=list[CurrentOutingOut])
def get_current_outings(current_user : User = Depends(get_current_user), db : Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    created_outings = db.query(Outing).filter(
        Outing.creator_id == current_user.id, Outing.proposed_time > now, Outing.status != "cancelled"
    ).all()
    accepted_outing_ids = [invite.outing_id for invite in db.query(OutingInvite).filter(
        OutingInvite.invitee_id == current_user.id, OutingInvite.status == "accepted"
    ).all()]
    accepted_outings = db.query(Outing).filter(
        Outing.id.in_(accepted_outing_ids), Outing.proposed_time > now, Outing.status != "cancelled"
    ).all() if accepted_outing_ids else []

    outings_by_id = {outing.id: outing for outing in created_outings}
    for outing in accepted_outings:
        outings_by_id[outing.id] = outing

    result = []
    for outing in outings_by_id.values():
        creator = db.query(User).filter(User.id == outing.creator_id).first()
        accepted_invites = db.query(OutingInvite).filter(
            OutingInvite.outing_id == outing.id, OutingInvite.status == "accepted"
        ).all()
        accepted_emails = [
            db.query(User).filter(User.id == invite.invitee_id).first().email
            for invite in accepted_invites
        ]
        result.append(CurrentOutingOut(
            id=outing.id,
            title=outing.title,
            location=outing.location,
            proposed_time=outing.proposed_time,
            creator_email=creator.email,
            accepted_invitee_emails=accepted_emails,
        ))
    result.sort(key=lambda o: o.proposed_time)
    return result

@app.post("/outings/{outing_id}/leave", response_model=OutingInviteOut)
def leave_outing(outing_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    invite = db.query(OutingInvite).filter(
        OutingInvite.outing_id == outing_id, OutingInvite.invitee_id == current_user.id
    ).first()
    if not invite:
        raise HTTPException(status_code=404, detail="you are not invited to this outing")
    if invite.status != "accepted":
        raise HTTPException(status_code=400, detail="you haven't accepted this outing")
    invite.status = "left"
    invite.responded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(invite)
    outing = db.query(Outing).filter(Outing.id == invite.outing_id).first()
    return OutingInviteOut(
        id=invite.id,
        outing_id=invite.outing_id,
        invitee_id=invite.invitee_id,
        status=invite.status,
        outing_title=outing.title,
        outing_location=outing.location,
        outing_time=outing.proposed_time,
        responded_at=invite.responded_at,
    )

@app.post("/outings/{outing_id}/delete", response_model=OutingOut)
def delete_outing(outing_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    outing = db.query(Outing).filter(Outing.id == outing_id).first()
    if not outing:
        raise HTTPException(status_code=404, detail="outing not found")
    if outing.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="only the creator can delete this outing")
    outing.status = "cancelled"
    db.commit()
    db.refresh(outing)
    return outing
