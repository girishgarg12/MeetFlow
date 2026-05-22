'use client';
import { Video, Search, Bell, Settings } from 'lucide-react';

export default function Navbar() {
  return (
    <nav
      style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {/* Left: Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #0B5CFF, #0047CC)',
            borderRadius: '10px',
            padding: '7px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(11, 92, 255, 0.35)',
          }}
        >
          <Video size={18} color="#fff" />
        </div>
        <span style={{ fontSize: '20px', fontWeight: 700, color: '#232333', letterSpacing: '-0.3px' }}>
          MeetFlow
        </span>
      </div>

      {/* Center: Search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#f3f4f6',
          borderRadius: '100px',
          padding: '8px 16px',
          width: '320px',
          gap: '8px',
          border: '1px solid #e5e7eb',
        }}
        className="hidden md:flex"
      >
        <Search size={15} color="#9ca3af" />
        <input
          type="text"
          placeholder="Search meetings..."
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '13px',
            color: '#374151',
            width: '100%',
          }}
        />
      </div>

      {/* Right: Icons + Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          title="Notifications"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            color: '#6b7280',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
        >
          <Bell size={19} />
        </button>
        <button
          title="Settings"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            color: '#6b7280',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
        >
          <Settings size={19} />
        </button>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0B5CFF, #0047CC)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(11,92,255,0.3)',
          }}
          title="Alex Johnson"
        >
          AJ
        </div>
      </div>
    </nav>
  );
}
