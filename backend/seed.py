from database import SessionLocal, engine, Base
from models import Meeting, Participant
from datetime import datetime, timedelta

Base.metadata.create_all(bind=engine)

db = SessionLocal()
db.query(Participant).delete()
db.query(Meeting).delete()
db.commit()

# SAMPLE MEETINGS
meetings = [
    Meeting(
        id="ABC123DEF",
        title="Team Daily Standup",
        description="Quick 15-min sync to align on today's priorities",
        host_name="Alex Johnson",
        meeting_type="scheduled",
        scheduled_at=datetime.utcnow() + timedelta(hours=2),
        duration=30,
        invite_link="http://localhost:3000/meeting/ABC123DEF",
        is_active=True,
    ),
    Meeting(
        id="XYZ789GHI",
        title="Product Roadmap Review",
        description="Q2 planning session with product and engineering",
        host_name="Alex Johnson",
        meeting_type="scheduled",
        scheduled_at=datetime.utcnow() + timedelta(days=1),
        duration=60,
        invite_link="http://localhost:3000/meeting/XYZ789GHI",
        is_active=True,
    ),
    Meeting(
        id="MNO456PQR",
        title="Design System Workshop",
        host_name="Alex Johnson",
        meeting_type="scheduled",
        scheduled_at=datetime.utcnow() + timedelta(days=3),
        duration=90,
        invite_link="http://localhost:3000/meeting/MNO456PQR",
        is_active=True,
    ),

    Meeting(
        id="DEF456JKL",
        title="Sprint Retrospective",
        description="End of sprint reflection meeting",
        host_name="Alex Johnson",
        meeting_type="instant",
        scheduled_at=datetime.utcnow() - timedelta(hours=3),
        duration=45,
        invite_link="http://localhost:3000/meeting/DEF456JKL",
        is_active=False,
    ),
    Meeting(
        id="STU123VWX",
        title="Client Demo - Project Alpha",
        host_name="Alex Johnson",
        meeting_type="instant",
        scheduled_at=datetime.utcnow() - timedelta(days=1),
        duration=60,
        invite_link="http://localhost:3000/meeting/STU123VWX",
        is_active=False,
    ),
]

for meeting in meetings:
    db.add(meeting)
db.commit()

# SAMPLE PARTICIPANTS

participants = [
    Participant(meeting_id="DEF456JKL", name="Alex Johnson", is_host=True),
    Participant(meeting_id="DEF456JKL", name="Sarah Chen"),
    Participant(meeting_id="DEF456JKL", name="Mike Wilson"),
    Participant(meeting_id="STU123VWX", name="Alex Johnson", is_host=True),
    Participant(meeting_id="STU123VWX", name="Client Representative"),
]

for p in participants:
    db.add(p)
db.commit()

db.close()
print("Database seeded successfully!")
print(f"   Created {len(meetings)} meetings and {len(participants)} participants")
