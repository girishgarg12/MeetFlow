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
    allow_origins=[frontend_url],
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

# Store active WebSocket connections per meeting room

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, meeting_id: str):
        await websocket.accept()
        if meeting_id not in self.active_connections:
            self.active_connections[meeting_id] = []
        self.active_connections[meeting_id].append(websocket)

    def disconnect(self, websocket: WebSocket, meeting_id: str):
        if meeting_id in self.active_connections:
            self.active_connections[meeting_id].remove(websocket)

    async def broadcast(self, message: dict, meeting_id: str):
        """Send a message to ALL participants in a meeting"""
        if meeting_id in self.active_connections:
            for connection in self.active_connections[meeting_id]:
                await connection.send_text(json.dumps(message))

manager = ConnectionManager()

@app.websocket("/ws/{meeting_id}/{user_name}")
async def websocket_endpoint(websocket: WebSocket, meeting_id: str, user_name: str):
    await manager.connect(websocket, meeting_id)

    # Notify all
    await manager.broadcast({
        "type": "user_joined",
        "user": user_name,
        "meeting_id": meeting_id
    }, meeting_id)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            # Relay the message to everyone else in the room
            await manager.broadcast(message, meeting_id)

    except WebSocketDisconnect:
        manager.disconnect(websocket, meeting_id)
        await manager.broadcast({
            "type": "user_left",
            "user": user_name,
            "meeting_id": meeting_id
        }, meeting_id)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)