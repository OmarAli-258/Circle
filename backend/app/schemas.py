from datetime import datetime
from pydantic import BaseModel
from typing import Optional

class UserCreate(BaseModel): 
    email: str
    password: str
class UserOut(BaseModel):
    id: int 
    email: str
    created_at : datetime
    model_config = {"from_attributes": True}
class UserLogin(BaseModel):
    email: str
    password : str
class Token(BaseModel):
    access_token : str
    token_type : str = "bearer"
class FriendRequestCreate(BaseModel):
    recipient_email : str
class FriendRequestOut(BaseModel):
    id : int
    requester_id : int
    requester_email : str
    recipient_id : int
    status : str
    created_at : datetime
    model_config = {"from_attributes" : True }
class AvailabilityCreate(BaseModel):
    start_time : datetime
    end_time : datetime
class AvailabilityOut(BaseModel): 
    id : int
    user_id : int
    start_time : datetime
    end_time : datetime
    created_at : datetime
    model_config = {"from_attributes" : True}
class OutingCreate(BaseModel):
    title : str
    proposed_time : datetime
    location : str 
    invitee_ids : list[int] 
class OutingOut(BaseModel):
    id : int 
    creator_id : int
    title : str
    proposed_time : datetime
    location : str
    status : str
    cancellation_message : Optional[str]
    created_at : datetime
    model_config = {"from_attributes": True}
class OutingInviteOut(BaseModel):
    id : int
    outing_id : int
    invitee_id : int
    status : str
    responded_at: Optional[datetime]
    model_config= {"from_attributes":True }