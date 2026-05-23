'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Video, Search, Bell, Settings, LogOut, User } from 'lucide-react';

// Deterministic avatar colour from name
const getAvatarBg = (name) => {
  const palettes = ['#0B5CFF', '#7c3aed', '#0891b2', '#059669', '#d97706'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palettes[Math.abs(h) % palettes.length];
};

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const avatarRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const name = localStorage.getItem('userName');
    if (token && name) {
      setUser({ token, username: name });
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const close = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showDropdown]);

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    localStorage.removeItem('participantId');
    localStorage.removeItem('participantMeetingId');
    localStorage.removeItem('isHost');
    setUser(null);
    setShowDropdown(false);
    window.location.reload();
  };

  const displayName = user ? user.username : 'Girish';
  const isGuest = !user;
  const color = getAvatarBg(displayName);
  const avatarBg = isGuest
    ? 'linear-gradient(135deg, #6b7280, #4b5563)'
    : `linear-gradient(135deg, ${color}, ${color}cc)`;

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

      {/* Center: Search (desktop only) */}
      <div
        style={{
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

      {/* Right: Actions + Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Sign In / Sign Out button */}
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

        {/* Notification & Settings — desktop only */}
        <button
          title="Notifications"
          className="hidden md:flex"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px', borderRadius: '8px',
            alignItems: 'center', color: '#6b7280', transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
        >
          <Bell size={19} />
        </button>
        <button
          title="Settings"
          className="hidden md:flex"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px', borderRadius: '8px',
            alignItems: 'center', color: '#6b7280', transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
        >
          <Settings size={19} />
        </button>

        {/* ── Avatar with dropdown ── */}
        <div ref={avatarRef} style={{ position: 'relative' }}>
          {/* Circle button */}
          <div
            id="avatar-btn"
            onClick={() => setShowDropdown((v) => !v)}
            title={displayName}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: avatarBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: showDropdown
                ? '0 0 0 3px rgba(11,92,255,0.25)'
                : '0 2px 6px rgba(0,0,0,0.15)',
              transition: 'box-shadow 0.15s',
              userSelect: 'none',
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>

          {/* Dropdown */}
          {showDropdown && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                minWidth: '210px',
                zIndex: 200,
                overflow: 'hidden',
              }}
            >
              {/* User info header */}
              <div
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid #f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                {/* Mini avatar */}
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: avatarBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '15px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>

                {/* Name + badge */}
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#111827',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {displayName}
                  </p>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '4px',
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '20px',
                      background: isGuest ? '#f3f4f6' : '#eff6ff',
                      color: isGuest ? '#6b7280' : '#2563eb',
                      border: isGuest ? '1px solid #e5e7eb' : '1px solid #bfdbfe',
                    }}
                  >
                    {isGuest ? 'Default User' : 'Signed In'}
                  </span>
                </div>
              </div>

              {/* Action row */}
              <div style={{ padding: '6px' }}>
                {isGuest ? (
                  <button
                    id="avatar-create-account-btn"
                    onClick={() => { setShowDropdown(false); router.push('/login'); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      width: '100%', background: 'none', border: 'none',
                      borderRadius: '8px', padding: '9px 10px',
                      cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                      color: '#0B5CFF', transition: 'background 0.12s', textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <User size={14} />
                    Create your account
                  </button>
                ) : (
                  <button
                    id="avatar-signout-btn"
                    onClick={handleSignOut}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      width: '100%', background: 'none', border: 'none',
                      borderRadius: '8px', padding: '9px 10px',
                      cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                      color: '#dc2626', transition: 'background 0.12s', textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
