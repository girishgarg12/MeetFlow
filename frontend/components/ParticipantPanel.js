'use client';
import { Users } from 'lucide-react';

export default function ParticipantPanel({ participants = [], currentUser = '' }) {
  return (
    <div
      style={{
        width: '260px',
        background: '#1f2937',
        borderLeft: '1px solid #374151',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #374151',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Users size={15} color="#9ca3af" />
        <span style={{ color: '#f9fafb', fontWeight: 600, fontSize: '14px' }}>
          Participants ({participants.length})
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {participants.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
            No participants yet
          </p>
        ) : (
          participants.map((p) => (
            <div
              key={p.id || p.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 10px',
                borderRadius: '10px',
                marginBottom: '4px',
                background: p.name === currentUser ? '#0B5CFF22' : 'transparent',
              }}
            >
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background:
                    p.name === currentUser
                      ? 'linear-gradient(135deg, #0B5CFF, #0047CC)'
                      : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    color: '#f9fafb',
                    fontSize: '13px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {p.name}
                  {p.name === currentUser && (
                    <span style={{ color: '#9ca3af', fontSize: '11px', marginLeft: '4px' }}>
                      (you)
                    </span>
                  )}
                </p>
                {p.is_host && (
                  <span style={{ color: '#60a5fa', fontSize: '11px' }}>Host</span>
                )}
                {p.is_muted && (
                  <span style={{ color: '#f87171', fontSize: '11px', marginLeft: '4px' }}>
                    🔇 Muted
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
