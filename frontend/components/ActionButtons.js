'use client';
import { Video, Plus, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createMeeting, joinMeeting } from '@/lib/api';
import { useState, useEffect } from 'react';

export default function ActionButtons() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [time, setTime] = useState(null);

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleNewMeeting = async () => {
    if (creating) return;
    setCreating(true);
    const activeName = (typeof window !== 'undefined' && localStorage.getItem('userName')) || 'Girish';
    try {
      const res = await createMeeting({
        title: 'Meeting Room',
        host_name: activeName,
        meeting_type: 'instant',
      });
      // Register host as participant
      const joinRes = await joinMeeting({
        meeting_id: res.data.id,
        name: activeName,
        is_host: true,
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('userName', joinRes.data.name);
        localStorage.setItem('isHost', 'true');
        localStorage.setItem('participantId', String(joinRes.data.id));
        localStorage.setItem('participantMeetingId', res.data.id);
      }
      router.push(`/meeting/${res.data.id}`);
    } catch (err) {
      alert('Failed to create meeting. Is the backend running at http://localhost:8000?');
      setCreating(false);
    }
  };

  const timeString = time
    ? time.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '';

  const dateString = time
    ? time.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : '';

  // Button interactive states
  const [hoveredBtn, setHoveredBtn] = useState(null);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: '40px',
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        padding: '32px 24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}
    >
      {/* Clock and Date */}
      <div
        style={{
          height: '76px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '28px',
        }}
      >
        {time ? (
          <>
            <h1
              style={{
                fontSize: '40px',
                fontWeight: 500,
                color: '#1a1a2e',
                margin: 0,
                letterSpacing: '-0.5px',
              }}
            >
              {timeString}
            </h1>
            <p
              style={{
                fontSize: '13px',
                color: '#5b5b66',
                margin: '4px 0 0 0',
                fontWeight: 500,
              }}
            >
              {dateString}
            </p>
          </>
        ) : (
          <div style={{ height: '76px' }} />
        )}
      </div>

      {/* Action Buttons Row */}
      <div style={{ display: 'flex', gap: '48px', justifyContent: 'center' }}>
        {/* New Meeting */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleNewMeeting}
            disabled={creating}
            onMouseEnter={() => setHoveredBtn('new')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: creating
                ? '#e5e7eb'
                : hoveredBtn === 'new'
                ? '#e0591b'
                : '#FF742E',
              color: '#ffffff',
              border: 'none',
              cursor: creating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
              transform: hoveredBtn === 'new' ? 'scale(1.04)' : 'scale(1)',
              boxShadow: hoveredBtn === 'new' ? '0 6px 16px rgba(255, 116, 46, 0.25)' : 'none',
            }}
          >
            {creating ? (
              <span style={{ color: '#fff', fontSize: '11px', fontWeight: 600 }}>...</span>
            ) : (
              <Video size={28} strokeWidth={2} />
            )}
          </button>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={handleNewMeeting}
          >
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#5b5b66' }}>
              {creating ? 'Creating...' : 'New meeting'}
            </span>
          </div>
        </div>

        {/* Join Meeting */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => router.push('/join')}
            onMouseEnter={() => setHoveredBtn('join')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: hoveredBtn === 'join' ? '#0047cc' : '#0B5CFF',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
              transform: hoveredBtn === 'join' ? 'scale(1.04)' : 'scale(1)',
              boxShadow: hoveredBtn === 'join' ? '0 6px 16px rgba(11, 92, 255, 0.25)' : 'none',
            }}
          >
            <Plus size={28} strokeWidth={2.2} />
          </button>
          <span
            onClick={() => router.push('/join')}
            style={{ fontSize: '12px', fontWeight: 500, color: '#5b5b66', cursor: 'pointer' }}
          >
            Join
          </span>
        </div>

        {/* Schedule */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => router.push('/schedule')}
            onMouseEnter={() => setHoveredBtn('schedule')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: hoveredBtn === 'schedule' ? '#0047cc' : '#0B5CFF',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
              transform: hoveredBtn === 'schedule' ? 'scale(1.04)' : 'scale(1)',
              boxShadow: hoveredBtn === 'schedule' ? '0 6px 16px rgba(11, 92, 255, 0.25)' : 'none',
            }}
          >
            <Calendar size={26} strokeWidth={2} />
          </button>
          <span
            onClick={() => router.push('/schedule')}
            style={{ fontSize: '12px', fontWeight: 500, color: '#5b5b66', cursor: 'pointer' }}
          >
            Schedule
          </span>
        </div>
      </div>
    </div>
  );
}
