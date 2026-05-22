'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import Navbar from '@/components/Navbar';
import ActionButtons from '@/components/ActionButtons';
import MeetingCard from '@/components/MeetingCard';
import { listMeetings, deleteMeeting } from '@/lib/api';
import { Calendar, Video, RefreshCw, AlertTriangle, Info, User, Shield, Hash, Clock, FileText } from 'lucide-react';

const parseUTCDate = (dateStr) => {
  if (!dateStr) return null;
  let normalized = dateStr;
  if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+') && !/-\d{2}:\d{2}$/.test(dateStr)) {
    normalized = dateStr + 'Z';
  }
  return new Date(normalized);
};

export default function Dashboard() {
  const router = useRouter();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMeetingDetails, setSelectedMeetingDetails] = useState(null);

  const formatTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return format(parseUTCDate(dateStr), 'EEEE, MMMM d, yyyy · h:mm a');
    } catch {
      return 'N/A';
    }
  };

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
    (m) => m.meeting_type === 'scheduled' && m.is_active && parseUTCDate(m.scheduled_at) > now
  );

  const recentMeetings = meetings.filter(
    (m) => !m.is_active || (m.scheduled_at && parseUTCDate(m.scheduled_at) < now && m.meeting_type === 'scheduled')
  );

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA' }}>
      <Navbar />

      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 24px' }}>

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
                <MeetingCard
                  key={m.id}
                  meeting={m}
                  type="upcoming"
                  onDelete={initiateDelete}
                  onViewDetails={setSelectedMeetingDetails}
                />
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
                <MeetingCard
                  key={m.id}
                  meeting={m}
                  type="recent"
                  onDelete={initiateDelete}
                  onViewDetails={setSelectedMeetingDetails}
                />
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
                  {meetingToDelete.created_at ? parseUTCDate(meetingToDelete.created_at).toLocaleDateString('en-US', {
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

      {/* Meeting Details Modal */}
      {selectedMeetingDetails && (
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
          onClick={() => setSelectedMeetingDetails(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '520px',
              padding: '28px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e5e7eb',
              margin: '0 16px',
              animation: 'scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Title & Close */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    background: '#e0eaff',
                    color: '#0B5CFF',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Info size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>
                    Meeting Details
                  </h3>
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                    ID: {selectedMeetingDetails.id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedMeetingDetails(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '0 4px',
                  lineHeight: '1',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#111827')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
              >
                &times;
              </button>
            </div>

            {/* Title Section */}
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: '0 0 8px 0', lineHeight: 1.3 }}>
                {selectedMeetingDetails.title}
              </h2>
            </div>

            {/* Grid details */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              {/* Host */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <User size={16} color="#6b7280" />
                <div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>Host</div>
                  <div style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>
                    {selectedMeetingDetails.host_name || 'Girish'}
                  </div>
                </div>
              </div>

              {/* Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Shield size={16} color="#6b7280" />
                <div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>Status</div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: selectedMeetingDetails.is_active ? '#047857' : '#4b5563',
                      background: selectedMeetingDetails.is_active ? '#ecfdf5' : '#f3f4f6',
                      padding: '2px 8px',
                      borderRadius: '100px',
                      marginTop: '2px',
                    }}
                  >
                    {selectedMeetingDetails.is_active ? 'Active' : 'Concluded'}
                  </span>
                </div>
              </div>

              {/* Type */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Hash size={16} color="#6b7280" />
                <div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>Meeting Type</div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: selectedMeetingDetails.meeting_type === 'scheduled' ? '#1d4ed8' : '#6d28d9',
                      background: selectedMeetingDetails.meeting_type === 'scheduled' ? '#dbeafe' : '#f3e8ff',
                      padding: '2px 8px',
                      borderRadius: '100px',
                      marginTop: '2px',
                      textTransform: 'capitalize',
                    }}
                  >
                    {selectedMeetingDetails.meeting_type}
                  </span>
                </div>
              </div>

              {/* Duration */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={16} color="#6b7280" />
                <div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>Duration</div>
                  <div style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>
                    {selectedMeetingDetails.duration} minutes
                  </div>
                </div>
              </div>

              {/* Time */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', gridColumn: 'span 2' }}>
                <Calendar size={16} color="#6b7280" style={{ marginTop: '3px' }} />
                <div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>Scheduled Time</div>
                  <div style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>
                    {formatTime(selectedMeetingDetails.scheduled_at || selectedMeetingDetails.created_at)}
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <FileText size={14} color="#6b7280" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#4b5563' }}>Description</span>
              </div>
              <div
                style={{
                  background: '#f9fafb',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '13px',
                  color: selectedMeetingDetails.description ? '#374151' : '#9ca3af',
                  lineHeight: '1.5',
                  border: '1px solid #f3f4f6',
                  fontStyle: selectedMeetingDetails.description ? 'normal' : 'italic',
                  maxHeight: '100px',
                  overflowY: 'auto',
                }}
              >
                {selectedMeetingDetails.description || 'No description provided for this meeting.'}
              </div>
            </div>

            {/* Invite Link */}
            <div style={{ marginBottom: '28px' }}>
              <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '8px' }}>
                Invite Link
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={selectedMeetingDetails.invite_link}
                  style={{
                    flex: 1,
                    background: '#f9fafb',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '13px',
                    color: '#374151',
                    outline: 'none',
                  }}
                  onClick={(e) => e.target.select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedMeetingDetails.invite_link).then(() => {
                      const btn = document.getElementById('details-copy-btn');
                      if (btn) {
                        const originalHtml = btn.innerHTML;
                        btn.innerHTML = 'Copied!';
                        btn.style.background = '#10b981';
                        btn.style.borderColor = '#10b981';
                        btn.style.color = '#ffffff';
                        setTimeout(() => {
                          btn.innerHTML = originalHtml;
                          btn.style.background = '#ffffff';
                          btn.style.borderColor = '#d1d5db';
                          btn.style.color = '#374151';
                        }, 2000);
                      }
                    });
                  }}
                  id="details-copy-btn"
                  style={{
                    padding: '8px 16px',
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#374151',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    minWidth: '80px',
                  }}
                  onMouseEnter={(e) => {
                    const btn = document.getElementById('details-copy-btn');
                    if (btn && btn.innerHTML !== 'Copied!') {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                      e.currentTarget.style.borderColor = '#c5c9d1';
                    }
                  }}
                  onMouseLeave={(e) => {
                    const btn = document.getElementById('details-copy-btn');
                    if (btn && btn.innerHTML !== 'Copied!') {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setSelectedMeetingDetails(null)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#374151',
                  cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                  e.currentTarget.style.borderColor = '#c5c9d1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }}
              >
                Close
              </button>

              {/* Start / Join button (if active) */}
              {selectedMeetingDetails.is_active && (
                <button
                  onClick={() => {
                    const isUpcoming = selectedMeetingDetails.meeting_type === 'scheduled' && parseUTCDate(selectedMeetingDetails.scheduled_at) > new Date();
                    if (isUpcoming) {
                      localStorage.setItem('userName', 'Girish');
                      localStorage.setItem('isHost', 'true');
                      router.push(`/meeting/${selectedMeetingDetails.id}`);
                    } else {
                      router.push(`/join?id=${selectedMeetingDetails.id}`);
                    }
                    setSelectedMeetingDetails(null);
                  }}
                  style={{
                    padding: '10px 24px',
                    background: 'linear-gradient(135deg, #0B5CFF, #0047CC)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'opacity 0.15s, transform 0.15s',
                    boxShadow: '0 2px 8px rgba(11,92,255,0.3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {selectedMeetingDetails.meeting_type === 'scheduled' && parseUTCDate(selectedMeetingDetails.scheduled_at) > new Date()
                    ? 'Start Meeting'
                    : 'Join Meeting'}
                </button>
              )}
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
