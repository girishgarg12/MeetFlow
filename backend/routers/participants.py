from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from schemas import ParticipantCreate, ParticipantOut
from typing import List
import crud
from routers.auth import get_current_user_optional

router = APIRouter()

@router.post("/", response_model=ParticipantOut)
def join_meeting(data: ParticipantCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user_optional)):
    """Record that a participant has joined a meeting"""
    meeting = crud.get_meeting(db, data.meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if not meeting.is_active:
        raise HTTPException(status_code=400, detail="Meeting has already ended")
    
    # Enforce that authenticated users use their registered username as participant name
    if current_user:
        data.name = current_user.username
        data.user_id = current_user.id
        
    return crud.join_meeting(db, data)

@router.get("/{meeting_id}", response_model=List[ParticipantOut])
def get_participants(meeting_id: str, db: Session = Depends(get_db)):
    """Get all current participants in a meeting"""
    return crud.get_participants(db, meeting_id)

@router.patch("/{participant_id}/leave")
def leave_meeting(participant_id: int, db: Session = Depends(get_db)):
    """Record that a participant has left"""
    participant = crud.leave_meeting(db, participant_id)
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")
    return {"message": "Left meeting"}