from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from schemas import MeetingCreate, MeetingOut
from typing import List
import crud

router = APIRouter()

@router.post("/", response_model=MeetingOut)
def create_meeting(data: MeetingCreate, db: Session = Depends(get_db)):
    """Create a new meeting"""
    return crud.create_meeting(db, data)

@router.get("/", response_model=List[MeetingOut])
def list_meetings(db: Session = Depends(get_db)):
    """Get all meetings"""
    return crud.get_all_meetings(db)

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