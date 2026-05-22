# MeetFlow — Video Conferencing Platform (Zoom Clone)

A full-stack video conferencing web application built with a modern Next.js frontend and a FastAPI backend, utilizing WebSockets for signaling and WebRTC for direct peer-to-peer audio/video streaming.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js, React, Tailwind CSS, Lucide React, Axios |
| **Backend** | FastAPI, Python, Uvicorn, WebSockets |
| **Database** | SQLite, SQLAlchemy ORM |
| **Real-time API** | WebRTC (Peer-to-Peer), WebSockets (Signaling) |

## Features

- **Dashboard (Home)**: Modern Zoom-style Command Center with live clock, quick meeting actions (Start instant, Join via ID, Schedule future meetings, Share screen placeholder), and lists of upcoming & past meetings.
- **New Instant Meeting**: One-click meeting creation with a unique 9-character code and immediate transition to the meeting room.
- **Join Meeting**: Clean join page validating meeting active status and registering the user in the database before entry.
- **Schedule Meeting**: Advanced scheduler allowing users to choose the topic, agenda, date, time, and duration of future meetings.
- **Meeting Room**: Direct peer-to-peer audio and video communication powered by WebRTC and STUN servers.
  - Interactive toolbar with microphone toggle (mute/unmute), camera toggle, security overlay, participants count, and chat panel triggers.
  - Real-time sync of active participants utilizing persistent WebSocket connections.
  - Custom user profiles and avatars displayed if camera is deactivated.
- **Responsive Navigation**: Retractable side menu and universal search navbar for rapid control.

## Project Structure

```text
MeetFlow/
├── backend/            # FastAPI application
│   ├── main.py         # Application entry & WebSockets
│   ├── database.py     # SQLite connection setup
│   ├── models.py       # SQLAlchemy database schemas
│   ├── schemas.py      # Pydantic data validators
│   ├── crud.py         # Database operations
│   ├── seed.py         # Sample data seeding script
│   └── routers/        # API route groups
│
└── frontend/           # Next.js application
    ├── app/            # Pages (Dashboard, Join, Schedule, Meeting)
    ├── components/     # Reusable layout and button components
    └── lib/            # Axios API calls
```

## Setup Instructions

### Prerequisites
- Python 3.9+
- Node.js 18+

### 1. Backend Setup

```bash
cd backend
# Create virtual environment
python -m venv venv
# Activate it (Windows)
venv\Scripts\activate
# Activate it (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed the database
python seed.py

# Run the FastAPI server
uvicorn main:app --reload --port 8000
```
FastAPI interactive docs will be available at: http://localhost:8000/docs

### 2. Frontend Setup

```bash
cd frontend
# Install npm dependencies
npm install

# Start the Next.js development server
npm run dev
```
The application will be accessible at: http://localhost:3000

## Database Schema

- **meetings** table: `id`, `title`, `description`, `host_name`, `meeting_type`, `scheduled_at`, `duration`, `invite_link`, `is_active`, `created_at`
- **participants** table: `id`, `meeting_id` (FK), `name`, `joined_at`, `left_at`, `is_host`, `is_muted`, `is_video_on`

## Key Design & Architecture Decisions

1. **Tailwind CSS v4 & PostCSS Integration**: Built with the latest Tailwind CSS v4, allowing fast builds and CSS-based variables configuration. Renamed custom variables using the `--app-` prefix to maintain compatibility with Tailwind's standard sizing utility scale.
2. **Hydration Mismatch Mitigation**: Safely initialized all client-specific browser interfaces (clock, `localStorage` checks) using lazy state loads and standard React `useEffect` mount cycles.
3. **Robust Layouts**: Relied on Flexbox shrink and gap controls in place of fragile sibling spacing properties for maximum responsiveness.
