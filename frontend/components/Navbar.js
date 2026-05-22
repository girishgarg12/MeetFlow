'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Video, Search, Bell, Settings, LogOut, User } from 'lucide-react';

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const name = localStorage.getItem('userName');
    if (token && name) {
      setUser({ token, username: name });
    }
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    localStorage.removeItem('participantId');
    localStorage.removeItem('participantMeetingId');
    localStorage.removeItem('isHost');
    setUser(null);
    window.location.reload();
  };

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
        {/* Sign In / Sign Out Button */}
        {user ? (
          <button
            onClick={handleSignOut}
            title="Sign Out"
            style={{
              background: 'none',
              border: '1.5px solid #e5e7eb',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#4b5563',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fef2f2';
              e.currentTarget.style.borderColor = '#fecaca';
              e.currentTarget.style.color = '#dc2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.color = '#4b5563';
            }}
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        ) : (
          <button
            onClick={() => router.push('/login')}
            style={{
              background: 'linear-gradient(135deg, #0B5CFF, #0047CC)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <User size={13} />
            <span>Login / Sign Up</span>
          </button>
        )}

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
          title={user ? user.username : 'Girish (Guest)'}
        >
          {user ? user.username.charAt(0).toUpperCase() : 'G'}
        </div>
      </div>
    </nav>
  );
}
