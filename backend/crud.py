
from sqlalchemy import or_
import config
import os
from sqlalchemy.orm import Session
from models import Meeting, Participant
from schemas import MeetingCreate, ParticipantCreate
from datetime import datetime
import uuid

# Meeting Operations

def generate_meeting_id():
    return str(uuid.uuid4()).replace("-", "").upper()[:9]

def create_meeting(db: Session, data: MeetingCreate):
    meeting_id  = generate_meeting_id()
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    invite_link = f"{frontend_url}/meeting/{meeting_id}"

    meeting = Meeting(
        id           = meeting_id,
        title        = data.title,
        description  = data.description,
        host_name    = data.host_name,
        host_id      = data.host_id,
        meeting_type = data.meeting_type,
        scheduled_at = data.scheduled_at,
        duration     = data.duration,
        invite_link  = invite_link,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting

def get_meeting(db: Session, meeting_id: str):
    return db.query(Meeting).filter(Meeting.id == meeting_id).first()

def get_all_meetings(db: Session, host_name: str = None, user_id: int = None):
    query = db.query(Meeting)
    if user_id is not None:
        query = query.filter(
            or_(
                Meeting.host_id == user_id,
                Meeting.participants.any(Participant.user_id == user_id)
            )
        )
    elif host_name:
        query = query.filter(
            or_(
                Meeting.host_name == host_name,
                Meeting.participants.any(Participant.name == host_name)
            )
        )
    return query.order_by(Meeting.created_at.desc()).all()

def end_meeting(db: Session, meeting_id: str):
    meeting = get_meeting(db, meeting_id)
    if meeting:
        meeting.is_active = False
        db.commit()
    return meeting

def delete_meeting(db: Session, meeting_id: str):
    meeting = get_meeting(db, meeting_id)
    if not meeting:
        return None
    db.query(Participant).filter(Participant.meeting_id == meeting_id).delete()
    db.delete(meeting)
    db.commit()
    return True


# Participant Operations

def join_meeting(db: Session, data: ParticipantCreate):
    participant = Participant(
        meeting_id = data.meeting_id,
        name       = data.name,
        is_host    = data.is_host,
        user_id    = data.user_id,
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant

def get_participants(db: Session, meeting_id: str):
    return db.query(Participant).filter(
        Participant.meeting_id == meeting_id,
        Participant.left_at == None   
    ).all()

def leave_meeting(db: Session, participant_id: int):
    participant = db.query(Participant).filter(Participant.id == participant_id).first()
    if participant:
        participant.left_at = datetime.utcnow()
        db.commit()
    return participant