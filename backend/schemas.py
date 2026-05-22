from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

# Meeting Schemas

class MeetingCreate(BaseModel):
    """frontend sends when creating a meeting"""

    title: str
    description: Optional[str] = None
    host_name: str = "Girish Garg"
    meeting_type: str = "instant"           
    scheduled_at: Optional[datetime] = None
    duration: int = 60

class MeetingOut(BaseModel):
    """API sends back about a meeting"""

    id: str
    title: str
    description: Optional[str]
    host_name: str
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

class ParticipantOut(BaseModel):
    """API sends back about a participant"""
    id: int
    meeting_id: str
    name: str
    joined_at: datetime
    left_at: Optional[datetime]
    is_host: bool
    is_muted: bool
    is_video_on: bool

    class Config:
        from_attributes = True