'use client';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import ActionButtons from '@/components/ActionButtons';
import MeetingCard from '@/components/MeetingCard';
import { listMeetings, deleteMeeting } from '@/lib/api';
import { Calendar, Video, RefreshCw, AlertTriangle } from 'lucide-react';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchMeetings = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await listMeetings();
      setMeetings(res.data);
      setError('');
    } catch (err) {
      setError('Could not load meetings. Make sure the backend is running at http://localhost:8000');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const [meetingToDelete, setMeetingToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const initiateDelete = (id) => {
    const meeting = meetings.find((m) => m.id === id);
    if (meeting) {
      setMeetingToDelete(meeting);
    }
  };

  const confirmDelete = async () => {
    if (!meetingToDelete) return;
    setDeleting(true);
    try {
      await deleteMeeting(meetingToDelete.id);
      setMeetings((prev) => prev.filter((m) => m.id !== meetingToDelete.id));
      setMeetingToDelete(null);
    } catch (err) {
      alert('Failed to delete meeting: ' + (err.response?.data?.detail || err.message));
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const now = new Date();

  const upcomingMeetings = meetings.filter(
    (m) => m.meeting_type === 'scheduled' && m.is_active && new Date(m.scheduled_at) > now
  );

  const recentMeetings = meetings.filter(
    (m) => !m.is_active || (m.scheduled_at && new Date(m.scheduled_at) < now && m.meeting_type === 'scheduled')
  );

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA' }}>
      <Navbar />

      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Greeting */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>
            {getGreeting()}, Alex 👋
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Action Buttons */}
        <ActionButtons />

        {/* Error state */}
        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '24px',
              color: '#dc2626',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Upcoming Meetings */}
        <section style={{ marginBottom: '32px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} color="#0B5CFF" />
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                Upcoming Meetings
              </h2>
              {!loading && (
                <span
                  style={{
                    background: '#dbeafe',
                    color: '#1d4ed8',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '100px',
                    padding: '2px 8px',
                  }}
                >
                  {upcomingMeetings.length}
                </span>
              )}
            </div>
            <button
              onClick={() => fetchMeetings(true)}
              title="Refresh"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#9ca3af',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#0B5CFF')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
            >
              <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    height: '72px',
                    background: 'linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.4s ease-in-out infinite',
                    borderRadius: '14px',
                  }}
                />
              ))}
            </div>
          ) : upcomingMeetings.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: '#ffffff',
                border: '1px dashed #e5e7eb',
                borderRadius: '14px',
              }}
            >
              <Calendar size={32} color="#d1d5db" style={{ margin: '0 auto 10px' }} />
              <p style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 500 }}>
                No upcoming meetings scheduled
              </p>
              <p style={{ fontSize: '12px', color: '#d1d5db', marginTop: '4px' }}>
                Click &quot;Schedule&quot; above to plan one
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {upcomingMeetings.map((m) => (
                <MeetingCard key={m.id} meeting={m} type="upcoming" />
              ))}
            </div>
          )}
        </section>

        {/* Recent Meetings */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Video size={16} color="#6b7280" />
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Recent Meetings</h2>
            {!loading && (
              <span
                style={{
                  background: '#f3f4f6',
                  color: '#6b7280',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: '100px',
                  padding: '2px 8px',
                }}
              >
                {recentMeetings.length}
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    height: '72px',
                    background: 'linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.4s ease-in-out infinite',
                    borderRadius: '14px',
                  }}
                />
              ))}
            </div>
          ) : recentMeetings.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: '#ffffff',
                border: '1px dashed #e5e7eb',
                borderRadius: '14px',
              }}
            >
              <Video size={32} color="#d1d5db" style={{ margin: '0 auto 10px' }} />
              <p style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 500 }}>
                No recent meetings
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentMeetings.map((m) => (
                <MeetingCard key={m.id} meeting={m} type="recent" onDelete={initiateDelete} />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Custom Confirmation Dialog */}
      {meetingToDelete && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(17, 24, 39, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => !deleting && setMeetingToDelete(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e5e7eb',
              margin: '0 16px',
              animation: 'scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
              <div
                style={{
                  backgroundColor: '#fee2e2',
                  borderRadius: '50%',
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#dc2626',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0, marginBottom: '6px' }}>
                  Delete Meeting
                </h3>
                <p style={{ fontSize: '14px', color: '#4b5563', margin: 0, lineHeight: 1.5 }}>
                  Are you sure you want to permanently delete the meeting <strong style={{ color: '#111827' }}>&ldquo;{meetingToDelete.title}&rdquo;</strong>?
                </p>
              </div>
            </div>

            {/* Modal Body Info */}
            <div
              style={{
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '24px',
                border: '1px solid #f3f4f6',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
                <span>Meeting ID:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#374151' }}>{meetingToDelete.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280' }}>
                <span>Created At:</span>
                <span style={{ fontWeight: 500, color: '#374151' }}>
                  {meetingToDelete.created_at ? new Date(meetingToDelete.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }) : 'N/A'}
                </span>
              </div>
            </div>

            {/* Modal Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                disabled={deleting}
                onClick={() => setMeetingToDelete(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#374151',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!deleting) {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                    e.currentTarget.style.borderColor = '#c5c9d1';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!deleting) {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }
                }}
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={confirmDelete}
                style={{
                  padding: '8px 20px',
                  background: deleting ? '#fca5a5' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.15s',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onMouseEnter={(e) => {
                  if (!deleting) e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  if (!deleting) e.currentTarget.style.opacity = '1';
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
