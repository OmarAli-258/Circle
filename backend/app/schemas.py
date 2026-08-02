from datetime import datetime
from pydantic import BaseModel

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
    recipient_id : int
class FriendRequestOut(BaseModel):
    id : int
    requester_id : int
    recipient_id : int
    status : str
    created_at : datetime
    model_config = {"from_attributes" : True }
    