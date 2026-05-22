from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

# Meeting Schemas

class MeetingCreate(BaseModel):
    """frontend sends when creating a meeting"""

    title: str
    description: Optional[str] = None
    host_name: str = "Girish Garg"
    host_id: Optional[int] = None
    meeting_type: str = "instant"           
    scheduled_at: Optional[datetime] = None
    duration: int = 60

class MeetingOut(BaseModel):
    """API sends back about a meeting"""

    id: str
    title: str
    description: Optional[str]
    host_name: str
    host_id: Optional[int]
    meeting_type: str
    scheduled_at: Optional[datetime]
    duration: int
    invite_link: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True  


# Participant Schemas

class ParticipantCreate(BaseModel):
    """frontend sends when joining a meeting"""

    meeting_id: str
    name: str
    is_host: bool = False
    user_id: Optional[int] = None

class ParticipantOut(BaseModel):
    """API sends back about a participant"""
    id: int
    meeting_id: str
    name: str
    user_id: Optional[int] = None
    joined_at: datetime
    left_at: Optional[datetime]
    is_host: bool
    is_muted: bool
    is_video_on: bool

    class Config:
        from_attributes = True


# User Schemas

class UserCreate(BaseModel):
    email: str
    username: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserOut(BaseModel):
    id: int
    email: str
    username: str
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str