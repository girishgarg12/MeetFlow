'use client';
import { format } from 'date-fns';
import { Clock, Copy, ExternalLink, CheckCircle, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function MeetingCard({ meeting, type, onDelete }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const copyLink = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(meeting.invite_link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return format(new Date(dateStr), 'MMM d, yyyy · h:mm a');
    } catch {
      return 'N/A';
    }
  };

  const isUpcoming = type === 'upcoming';

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e5e7eb',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        transition: 'box-shadow 0.18s ease, transform 0.18s ease',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Left: Color dot + text */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
        <div
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: isUpcoming
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : 'linear-gradient(135deg, #9ca3af, #6b7280)',
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#111827',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginBottom: '4px',
            }}
          >
            {meeting.title}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#6b7280' }}>
            <Clock size={12} />
            <span style={{ fontSize: '12px' }}>
              {formatTime(meeting.scheduled_at || meeting.created_at)}
            </span>
          </div>
          <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>ID: {meeting.id}</p>
        </div>
      </div>

      {/* Right: Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {/* Copy link */}
        <button
          onClick={copyLink}
          title="Copy invite link"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            border: 'none',
            background: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            color: copied ? '#10b981' : '#9ca3af',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f3f4f6';
            if (!copied) e.currentTarget.style.color = '#0B5CFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            if (!copied) e.currentTarget.style.color = '#9ca3af';
          }}
        >
          {copied ? <CheckCircle size={15} /> : <Copy size={15} />}
        </button>

        {type === 'recent' && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(meeting.id);
            }}
            title="Delete meeting"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: 'none',
              background: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#9ca3af',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fef2f2';
              e.currentTarget.style.color = '#dc2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            <Trash2 size={15} />
          </button>
        )}

        {isUpcoming && (
          <button
            id={`start-btn-${meeting.id}`}
            onClick={() => {
              localStorage.setItem('userName', 'Alex Johnson');
              localStorage.setItem('isHost', 'true');
              router.push(`/meeting/${meeting.id}`);
            }}
            style={{
              padding: '6px 14px',
              background: 'linear-gradient(135deg, #0B5CFF, #0047CC)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.15s, transform 0.15s',
              boxShadow: '0 2px 8px rgba(11,92,255,0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
              e.currentTarget.style.transform = 'scale(1.03)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Start
          </button>
        )}

        {type === 'recent' && (
          <button
            id={`rejoin-btn-${meeting.id}`}
            onClick={() => router.push(`/join?id=${meeting.id}`)}
            style={{
              padding: '6px 14px',
              background: 'none',
              color: '#0B5CFF',
              border: '1.5px solid #0B5CFF',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f4ff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            Join Again
          </button>
        )}
      </div>
    </div>
  );
}
