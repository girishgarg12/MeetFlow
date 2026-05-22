from sqlalchemy import Column, String, Integer, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import uuid

class Meeting(Base):
    __tablename__ = "meetings"

    id            = Column(String(9), primary_key=True)
    title         = Column(String(255), nullable=False)
    description   = Column(Text, nullable=True)
    host_name     = Column(String(100), nullable=False, default="Girish")
    host_id       = Column(Integer, ForeignKey("users.id"), nullable=True)

    meeting_type  = Column(String(20), default="instant")

    scheduled_at  = Column(DateTime, nullable=True)
    duration      = Column(Integer, default=60)          
    invite_link   = Column(String(500), unique=True)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    participants  = relationship("Participant", back_populates="meeting", cascade="all, delete")


class Participant(Base):
    __tablename__ = "participants"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    meeting_id  = Column(String(9), ForeignKey("meetings.id"), nullable=False)
    name        = Column(String(100), nullable=False)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=True)
    joined_at   = Column(DateTime, default=datetime.utcnow)
    left_at     = Column(DateTime, nullable=True)       
    is_host     = Column(Boolean, default=False)
    is_muted    = Column(Boolean, default=False)
    is_video_on = Column(Boolean, default=True)

    meeting     = relationship("Meeting", back_populates="participants")


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    username        = Column(String(100), unique=True, nullable=False)
    email           = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow)
