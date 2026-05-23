import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Add interceptor to inject JWT token into all requests automatically if present
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Meeting endpoints
export const createMeeting = (data) => api.post('/meetings/', data);
export const getMeeting    = (id)   => api.get(`/meetings/${id}`);
export const listMeetings  = ()     => api.get('/meetings/');
export const endMeeting    = (id)   => api.patch(`/meetings/${id}/end`);
export const deleteMeeting = (id)   => api.delete(`/meetings/${id}`);

// Participant endpoints
export const joinMeeting     = (data) => api.post('/participants/', data);
export const getParticipants = (id)   => api.get(`/participants/${id}`);
export const leaveMeeting    = (id)   => api.patch(`/participants/${id}/leave`);

// Authentication endpoints
export const signup = (data) => api.post('/auth/signup', data);
export const login  = (data) => api.post('/auth/login', data);
export const getMe  = ()     => api.get('/auth/me');

export default api;
