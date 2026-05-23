import config
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import meetings, participants, auth
from typing import Dict, List
import json

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MeetFlow API",
    description="Backend for MeetFlow Assignment",
    version="1.0.0"
)

frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(meetings.router,     prefix="/api/meetings",     tags=["Meetings"])
app.include_router(participants.router, prefix="/api/participants", tags=["Participants"])
app.include_router(auth.router,         prefix="/api/auth",         tags=["Auth"])

@app.get("/")
def root():
    return {"message": "MeetFlow API is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# Store active WebSocket connections per meeting room

class ConnectionManager:
    def __init__(self):
        # { meeting_id: { peer_id: websocket } }
        self.rooms: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, websocket: WebSocket, meeting_id: str, peer_id: str):
        await websocket.accept()
        if meeting_id not in self.rooms:
            self.rooms[meeting_id] = {}
        self.rooms[meeting_id][peer_id] = websocket

    def disconnect(self, meeting_id: str, peer_id: str):
        if meeting_id in self.rooms:
            self.rooms[meeting_id].pop(peer_id, None)
            if not self.rooms[meeting_id]:
                del self.rooms[meeting_id]

    async def broadcast(self, message: dict, meeting_id: str, exclude_peer: str = None):
        """Send a message to ALL participants in a meeting (optionally skip one)"""
        if meeting_id in self.rooms:
            dead = []
            for pid, connection in self.rooms[meeting_id].items():
                if pid == exclude_peer:
                    continue
                try:
                    await connection.send_text(json.dumps(message))
                except Exception:
                    dead.append(pid)
            for pid in dead:
                self.rooms[meeting_id].pop(pid, None)

manager = ConnectionManager()

@app.websocket("/ws/{meeting_id}/{peer_id}/{user_name}")
async def websocket_endpoint(websocket: WebSocket, meeting_id: str, peer_id: str, user_name: str):
    await manager.connect(websocket, meeting_id, peer_id)

    # Notify everyone in the room that a new peer joined (carries both peerId and display name)
    await manager.broadcast({
        "type": "user_joined",
        "peerId": peer_id,
        "name": user_name,
        "meeting_id": meeting_id
    }, meeting_id)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            # Relay the message to everyone in the room
            await manager.broadcast(message, meeting_id)

    except WebSocketDisconnect:
        manager.disconnect(meeting_id, peer_id)
        await manager.broadcast({
            "type": "user_left",
            "peerId": peer_id,
            "name": user_name,
            "meeting_id": meeting_id
        }, meeting_id)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)