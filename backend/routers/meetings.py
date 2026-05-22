from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from database import get_db
from schemas import MeetingCreate, MeetingOut
from typing import List, Optional
import crud
from routers.auth import get_current_user_optional

router = APIRouter()

@router.post("/", response_model=MeetingOut)
def create_meeting(
    data: MeetingCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_optional)
):
    """Create a new meeting"""
    if current_user:
        data.host_name = current_user.username
        data.host_id = current_user.id
    return crud.create_meeting(db, data)

@router.get("/", response_model=List[MeetingOut])
def list_meetings(db: Session = Depends(get_db), current_user = Depends(get_current_user_optional)):
    """Get all meetings, filtered by host if authenticated"""
    host_name = current_user.username if current_user else None
    user_id = current_user.id if current_user else None
    return crud.get_all_meetings(db, host_name=host_name, user_id=user_id)

@router.get("/{meeting_id}", response_model=MeetingOut)
def get_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """Get one meeting by ID"""
    meeting = crud.get_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting

@router.patch("/{meeting_id}/end")
def end_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """Mark a meeting as ended"""
    meeting = crud.end_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return {"message": "Meeting ended", "meeting_id": meeting_id}

@router.delete("/{meeting_id}")
def delete_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """Permanently delete a meeting and all its participants from the database"""
    result = crud.delete_meeting(db, meeting_id)
    if not result:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return {"message": "Meeting deleted", "meeting_id": meeting_id}