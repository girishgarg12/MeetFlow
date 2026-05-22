'use client';
import { Video, Plus, Calendar, Monitor } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createMeeting, joinMeeting } from '@/lib/api';
import { useState } from 'react';

const actions = [
  {
    key: 'new',
    label: 'New Meeting',
    icon: Video,
    bg: 'linear-gradient(135deg, #ff6b35, #f7931e)',
    cardBg: '#fff7f3',
    cardBorder: '#fed7aa',
    iconBg: 'linear-gradient(135deg, #ff6b35, #f7931e)',
    shadowColor: 'rgba(255, 107, 53, 0.25)',
  },
  {
    key: 'join',
    label: 'Join Meeting',
    icon: Plus,
    bg: 'linear-gradient(135deg, #0B5CFF, #0047CC)',
    cardBg: '#f0f4ff',
    cardBorder: '#bfdbfe',
    iconBg: 'linear-gradient(135deg, #0B5CFF, #0047CC)',
    shadowColor: 'rgba(11, 92, 255, 0.22)',
  },
  {
    key: 'schedule',
    label: 'Schedule',
    icon: Calendar,
    bg: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    cardBg: '#f5f3ff',
    cardBorder: '#c4b5fd',
    iconBg: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    shadowColor: 'rgba(99, 102, 241, 0.22)',
  },
  {
    key: 'share',
    label: 'Share Screen',
    icon: Monitor,
    bg: 'linear-gradient(135deg, #10b981, #059669)',
    cardBg: '#ecfdf5',
    cardBorder: '#a7f3d0',
    iconBg: 'linear-gradient(135deg, #10b981, #059669)',
    shadowColor: 'rgba(16, 185, 129, 0.22)',
  },
];

export default function ActionButtons() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const handleNewMeeting = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await createMeeting({
        title: 'My Instant Meeting',
        host_name: 'Alex Johnson',
        meeting_type: 'instant',
      });
      // Register host as participant
      await joinMeeting({
        meeting_id: res.data.id,
        name: 'Alex Johnson',
        is_host: true,
      });
      localStorage.setItem('userName', 'Alex Johnson');
      localStorage.setItem('isHost', 'true');
      router.push(`/meeting/${res.data.id}`);
    } catch (err) {
      alert('Failed to create meeting. Is the backend running at http://localhost:8000?');
      setCreating(false);
    }
  };

  const handleClick = (key) => {
    if (key === 'new') handleNewMeeting();
    else if (key === 'join') router.push('/join');
    else if (key === 'schedule') router.push('/schedule');
    else if (key === 'share') alert('Screen sharing is available inside a meeting room.');
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '32px',
      }}
      className="grid-cols-2 md:grid-cols-4"
    >
      {actions.map(({ key, label, icon: Icon, cardBg, cardBorder, iconBg, shadowColor }) => (
        <button
          key={key}
          id={`action-btn-${key}`}
          onClick={() => handleClick(key)}
          disabled={key === 'new' && creating}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: '18px',
            padding: '24px 16px',
            cursor: 'pointer',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease',
            boxShadow: `0 2px 8px ${shadowColor}`,
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = `0 8px 24px ${shadowColor}`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = `0 2px 8px ${shadowColor}`;
          }}
        >
          <div
            style={{
              background: iconBg,
              borderRadius: '50%',
              width: '52px',
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 4px 12px ${shadowColor}`,
            }}
          >
            {key === 'new' && creating ? (
              <span style={{ color: '#fff', fontSize: '11px', fontWeight: 600 }}>...</span>
            ) : (
              <Icon size={22} color="#fff" strokeWidth={2.2} />
            )}
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#232333' }}>
            {key === 'new' && creating ? 'Creating...' : label}
          </span>
        </button>
      ))}
    </div>
  );
}
