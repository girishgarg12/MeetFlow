'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Video, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { getMeeting, joinMeeting } from '@/lib/api';

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [meetingId, setMeetingId] = useState('');
  const [name, setName] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) setMeetingId(id);
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      const activeName = localStorage.getItem('userName');
      if (token && activeName) {
        setIsLoggedIn(true);
        setName(activeName);
      } else if (activeName) {
        setName(activeName);
      }
    }
  }, [searchParams]);

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');

    if (!meetingId.trim()) return setError('Please enter a Meeting ID');
    if (!name.trim()) return setError('Please enter your display name');

    setLoading(true);
    try {
      // Step 1: Validate meeting exists and is active
      await getMeeting(meetingId.trim());

      // Step 2: Register as participant
      const res = await joinMeeting({
        meeting_id: meetingId.trim(),
        name: name.trim(),
        is_host: false,
      });

      // Step 3: Save info for meeting room
      localStorage.setItem('userName', res.data.name);
      localStorage.setItem('participantId', String(res.data.id));
      localStorage.setItem('participantMeetingId', meetingId.trim());
      localStorage.setItem('isHost', 'false');

      // Step 4: Enter the meeting room
      router.push(`/meeting/${meetingId.trim()}`);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Meeting not found. Double-check your Meeting ID.');
      } else if (err.response?.status === 400) {
        setError('This meeting has already ended. You cannot join it.');
      } else {
        setError('Something went wrong. Make sure the backend is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    border: '1.5px solid #e5e7eb',
    borderRadius: '10px',
    padding: '12px 16px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: 'inherit',
    background: '#fafafa',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea22, #764ba222)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* Background pattern */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'radial-gradient(circle at 20% 50%, rgba(11, 92, 255, 0.07) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.06) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
          position: 'relative',
          zIndex: 1,
        }}
        className="p-6 sm:p-10"
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #0B5CFF, #0047CC)',
              borderRadius: '12px',
              padding: '10px',
              boxShadow: '0 4px 12px rgba(11, 92, 255, 0.3)',
            }}
          >
            <Video size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
              Join a Meeting
            </h1>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '2px' }}>
              Enter the meeting ID to join
            </p>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: '24px 0' }} />

        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Meeting ID */}
          <div>
            <label
              htmlFor="meeting-id"
              style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}
            >
              Meeting ID <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="meeting-id"
              type="text"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value.toUpperCase())}
              placeholder="e.g. ABC123DEF"
              style={inputStyle}
              onFocus={(e) => {
                e.target.style.borderColor = '#0B5CFF';
                e.target.style.boxShadow = '0 0 0 3px rgba(11,92,255,0.1)';
                e.target.style.background = '#fff';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Name */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label
                htmlFor="display-name"
                style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}
              >
                Your Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              {isLoggedIn && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#0B5CFF',
                    background: '#E8F3FF',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  Logged In Account
                </span>
              )}
            </div>
            <input
              id="display-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your display name"
              disabled={isLoggedIn}
              readOnly={isLoggedIn}
              style={{
                ...inputStyle,
                cursor: isLoggedIn ? 'not-allowed' : 'text',
                background: isLoggedIn ? '#f3f4f6' : '#fafafa',
                color: isLoggedIn ? '#6b7280' : '#111827',
              }}
              onFocus={(e) => {
                if (isLoggedIn) return;
                e.target.style.borderColor = '#0B5CFF';
                e.target.style.boxShadow = '0 0 0 3px rgba(11,92,255,0.1)';
                e.target.style.background = '#fff';
              }}
              onBlur={(e) => {
                if (isLoggedIn) return;
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                padding: '12px 14px',
                color: '#dc2626',
                fontSize: '13px',
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => router.push('/')}
              style={{
                flex: 1,
                padding: '12px',
                border: '1.5px solid #e5e7eb',
                background: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#374151',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'background 0.15s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <ArrowLeft size={15} />
              Cancel
            </button>
            <button
              id="join-submit-btn"
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                background: loading
                  ? '#93c5fd'
                  : 'linear-gradient(135deg, #0B5CFF, #0047CC)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'opacity 0.15s',
                fontFamily: 'inherit',
                boxShadow: loading ? 'none' : '0 4px 12px rgba(11,92,255,0.3)',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  Joining...
                </>
              ) : (
                'Join Meeting'
              )}
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
      <JoinForm />
    </Suspense>
  );
}
