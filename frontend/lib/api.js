import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

// ─── MEETING CALLS ────────────────────────────────────────────

export const createMeeting = (data) => api.post('/meetings/', data);
export const getMeeting    = (id)   => api.get(`/meetings/${id}`);
export const listMeetings  = ()     => api.get('/meetings/');
export const endMeeting    = (id)   => api.patch(`/meetings/${id}/end`);

// ─── PARTICIPANT CALLS ────────────────────────────────────────

export const joinMeeting     = (data) => api.post('/participants/', data);
export const getParticipants = (id)   => api.get(`/participants/${id}`);
export const leaveMeeting    = (id)   => api.patch(`/participants/${id}/leave`);

export default api;
