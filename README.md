# MeetFlow — Video Conferencing Platform

A full-stack video conferencing app built as part of a SDE Intern assignment. The goal was to replicate Zoom's core meeting workflows and design using Next.js and FastAPI.

**Live Demo:** [meetfloww.vercel.app](https://meetfloww.vercel.app)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), React, Vanilla CSS, Lucide React, Axios |
| Backend | FastAPI, Python, Uvicorn |
| Database | SQLite, SQLAlchemy ORM |
| Real-time | WebRTC (peer-to-peer A/V), WebSockets (signaling) |
| Deployment | Vercel (frontend), Railway (backend) |

---

## Features

### Core

- **Dashboard** — Zoom-style home with live clock, quick action buttons (New Meeting, Join, Schedule), upcoming meetings, and recent meetings list
- **Instant Meeting** — One-click meeting creation with a unique 9-character ID and a shareable invite link
- **Join Meeting** — Join via Meeting ID or invite link, enter a display name, validates meeting exists before entry
- **Schedule Meeting** — Create future meetings with title, description, date, time, and duration; shows up in the upcoming meetings list
- **Meeting Room** — Real peer-to-peer audio/video using WebRTC and Google STUN servers
  - Mic and camera toggle
  - Participants list with live join/leave updates
  - In-meeting chat with unread message counter
  - Leave meeting with confirmation dropdown
  - Responsive grid layout that adjusts based on participant count

### Auth (Bonus)

- Login and Signup with JWT tokens
- Profile avatar dropdown in navbar showing name and account status
- Guest users (no account) are supported — default name is used

---

## What's UI-Only (No Backend)

These elements exist purely to match Zoom's interface and are not functional:

- **Search bar** in the navbar
- **Notifications bell** and **Settings gear** icon
- **Filters** on the meetings list

---

## Project Structure

```
MeetFlow/
├── backend/
│   ├── main.py          # FastAPI app + WebSocket signaling server
│   ├── models.py        # SQLAlchemy models (Meeting, Participant, User)
│   ├── schemas.py       # Pydantic request/response schemas
│   ├── crud.py          # Database operations
│   ├── database.py      # SQLite connection and session setup
│   ├── seed.py          # Seeds sample meetings and a default user
│   └── routers/         # meetings, participants, auth
│
└── frontend/
    ├── app/             # Pages — dashboard, join, schedule, meeting room, login
    ├── components/      # Navbar, reusable UI
    └── lib/             # Axios API client
```

---

## Database Schema

Three tables:

**users** — `id`, `username`, `email`, `hashed_password`, `created_at`

**meetings** — `id` (9-char), `title`, `description`, `host_name`, `host_id` (FK → users), `meeting_type`, `scheduled_at`, `duration`, `invite_link`, `is_active`, `created_at`

**participants** — `id`, `meeting_id` (FK → meetings), `name`, `user_id` (FK → users, nullable for guests), `joined_at`, `left_at`, `is_host`, `is_muted`, `is_video_on`

`user_id` is nullable so unauthenticated (guest) users can join without an account.

---

## Setup — Local Development

**Prerequisites:** Python 3.9+, Node.js 18+

### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
python seed.py
uvicorn main:app --reload --port 8000
```

API docs available at `http://localhost:8000/docs`

### Frontend

Create `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:3000`

---

## A Few Implementation Notes

- **WebRTC signaling** uses a WebSocket server on FastAPI. Each participant gets a UUID (`peerId`) generated client-side per session. All offer/answer/ICE messages route by `peerId`, not by display name — this allows multiple participants with the same display name to coexist without connection conflicts.

- **Guest support** — the app works without login. A default user ("Girish") is seeded. Meetings are attributed via `host_name` for guests and `host_id` for logged-in users.

- **No `100vh` on mobile** — the meeting room uses `100dvh` (dynamic viewport height) so the control bar doesn't hide behind the browser's address bar on mobile.

- **Seeded data** — `seed.py` creates sample meetings and a default user so the dashboard isn't empty on first run.
