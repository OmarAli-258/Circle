from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1)
class UserOut(BaseModel):
    id: int
    email: str
    username: Optional[str]
    display_name: str
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
    requester_display_name : str
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
    outing_title : str
    outing_location : str
    outing_time : datetime
    responded_at: Optional[datetime]
    model_config= {"from_attributes":True }
class CurrentOutingOut(BaseModel):
    id : int
    title : str
    location : str
    proposed_time : datetime
    creator_email : str
    creator_display_name : str
    accepted_invitee_emails : list[str]
    accepted_invitee_display_names : list[str]
class MatchOut(BaseModel):
    id : int
    email : str
    display_name : str
    created_at : datetime
    overlap_start : datetime
    overlap_end : datetime